import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import fs from 'node:fs';
import { db } from './src/db.js';
import { pollFeeds, activeCalls, pollState } from './src/ingest.js';
import { FEEDS } from './src/feeds.js';
import { geocodeUserAddress } from './src/geocode.js';
import { stripe, activateFromSession, setStatusBySub, newToken } from './src/billing.js';
import { sendEmail } from './src/notify.js';
import { renderPage, renderSitemap, esc } from './src/render.js';
import {
  AREAS, BASE_URL, SITE_NAME, POLL_MINUTES, ACTIVE_WINDOW_MIN, TILE_URL, TILE_ATTRIBUTION,
  CATEGORIES, MAX_ZONES, MIN_RADIUS, MAX_RADIUS, inOrangeCounty,
} from './src/config.js';

const app = express();
app.set('trust proxy', 1);

const tileHost = (() => { try { return new URL(TILE_URL.replace(/\{s\}/, 'a')).origin.replace(/\/\/a\./, '//*.'); } catch { return 'https:'; } })();
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', tileHost, 'https://*.tile.openstreetmap.org', 'https://cdnjs.cloudflare.com'],
    connectSrc: ["'self'"],
  } },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());

// ---------- Stripe webhook (needs the raw body, so it comes before express.json) ----------
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.sendStatus(503);
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); }
  catch (e) { return res.status(400).send(`Webhook error: ${e.message}`); }
  try {
    const o = event.data.object;
    if (event.type === 'checkout.session.completed') await activateFromSession(o);
    if (event.type === 'customer.subscription.updated') setStatusBySub(o.id, o.status);
    if (event.type === 'customer.subscription.deleted') setStatusBySub(o.id, 'canceled');
  } catch (e) { console.error('[webhook]', e); return res.sendStatus(500); }
  res.json({ received: true });
});

app.use(express.json({ limit: '20kb' }));
const api = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });
const strict = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

// ---------- Pages ----------
const nextPollAt = () => { const ms = POLL_MINUTES * 60_000; return Math.ceil(Date.now() / ms) * ms; };
const cachePage = (res) => res.set('Cache-Control', 'public, max-age=60');

app.get('/', (req, res) => cachePage(res).send(renderPage({ calls: activeCalls() })));
app.get('/area/:slug', (req, res, next) => {
  const area = AREAS.find((a) => a.slug === req.params.slug);
  if (!area) return next();
  cachePage(res).send(renderPage({ calls: activeCalls(), area }));
});

const staticPage = (file) => {
  const html = fs.readFileSync(new URL(`./public/${file}`, import.meta.url), 'utf8')
    .replace(/<link rel="canonical" href="\//, `<link rel="canonical" href="${BASE_URL}/`)
    .replaceAll('Orlando Call Map', esc(SITE_NAME));
  return (req, res) => res.type('html').send(html);
};
app.get('/alerts', staticPage('alerts.html'));
app.get('/terms', staticPage('terms.html'));
app.get('/privacy', staticPage('privacy.html'));
const managePage = staticPage('manage.html');
app.get(['/manage', '/manage/:token'], (req, res) => { res.set('X-Robots-Tag', 'noindex'); managePage(req, res); });

app.get('/alerts/success', async (req, res) => {
  res.set('X-Robots-Tag', 'noindex');
  let sub = null;
  try { if (stripe && req.query.session_id) sub = await activateFromSession(await stripe.checkout.sessions.retrieve(String(req.query.session_id))); }
  catch (e) { console.error('[success]', e.message); }
  const body = sub
    ? `<h1>Your alerts are on</h1><p>We'll alert you when a call is dispatched inside your area. We also emailed you this link. Bookmark it to change your places or cancel:</p>
       <p><a class="cta" href="/manage/${esc(sub.token)}">Manage my alerts</a></p>`
    : `<h1>Payment received</h1><p>We're finishing setup. Your manage link will arrive by email within a few minutes. If it doesn't, <a href="/manage">request it here</a>.</p>`;
  res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Alerts on | ${esc(SITE_NAME)}</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;600&display=swap"><link rel="stylesheet" href="/styles.css"></head>
<body class="form-page"><main class="doc">${body}<p><a href="/">Back to live map</a></p></main></body></html>`);
});

app.get('/robots.txt', (req, res) => res.type('text').send(
  `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /manage\nDisallow: /alerts/success\n\nSitemap: ${BASE_URL}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(renderSitemap()));

app.use(express.static('public', { maxAge: '1h', index: false, extensions: [] }));

// ---------- Public API ----------
app.get('/api/config', (req, res) => res.json({ tileUrl: TILE_URL, tileAttribution: TILE_ATTRIBUTION }));

app.get('/api/calls', api, (req, res) => {
  res.set('Cache-Control', 'public, max-age=30');
  res.json({
    serverTime: Date.now(), lastPollAt: pollState.lastRun || null, nextPollAt: nextPollAt(), windowMin: ACTIVE_WINDOW_MIN,
    calls: activeCalls().map(({ id, agency, agency_name, category, type, address, lat, lng, received_at, first_seen }) =>
      ({ id, agency, agency_name, category, type, address, lat, lng, received_at, first_seen })),
  });
});

app.get('/api/health', (req, res) => res.json({
  ok: true, feeds: FEEDS.map((f) => ({ agency: f.agency, lastOk: pollState.lastOk[f.agency] || null, error: pollState.lastError[f.agency] || null })),
  lastPoll: pollState.lastRun, active: activeCalls().length,
}));

app.post('/api/geocode', strict, async (req, res) => {
  const p = await geocodeUserAddress(req.body?.address);
  if (!p) return res.status(422).json({ error: 'We couldn’t place that address in Orange County, FL. Include the street number, street and city.' });
  res.json(p);
});

// ---------- Subscribe ----------
const normPhone = (s) => {
  const d = String(s || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
};
const clampR = (r) => Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Math.round((+r || 1) * 4) / 4));
const cleanCats = (c) => (Array.isArray(c) ? c : []).filter((x) => CATEGORIES.includes(x));

app.post('/api/subscribe', strict, async (req, res) => {
  if (!stripe || !process.env.STRIPE_PRICE_ID) return res.status(503).json({ error: 'Payments aren’t set up yet. Add your Stripe keys to the server.' });
  const { email, phone, categories, zone } = req.body || {};
  const em = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) || em.length > 200) return res.status(400).json({ error: 'Enter a valid email address.' });
  const ph = normPhone(phone);
  if (ph === null) return res.status(400).json({ error: 'Enter a 10-digit US mobile number, or leave it blank.' });
  const cats = cleanCats(categories);
  if (!cats.length) return res.status(400).json({ error: 'Choose at least one type of call.' });
  const existing = db.prepare("SELECT status FROM subscribers WHERE email = ? AND status IN ('active','trialing','past_due')").get(em);
  if (existing) return res.status(409).json({ error: 'This email already has alerts. Use your manage link to add places, or request it at /manage.' });

  const p = await geocodeUserAddress(zone?.address);
  if (!p) return res.status(422).json({ error: 'We couldn’t place that address in Orange County, FL.' });

  const token = newToken();
  db.prepare('INSERT INTO pending (token, data, created_at) VALUES (?, ?, ?)').run(token, JSON.stringify({
    email: em, phone: ph, sms: !!ph, categories: cats.join(','),
    zone: { address: String(zone.address).slice(0, 200), label: String(zone.label || 'Home').slice(0, 30), radius: clampR(zone.radius), lat: p.lat, lng: p.lng },
  }), Date.now());

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      customer_email: em,
      metadata: { pending: token },
      subscription_data: { metadata: { pending: token } },
      allow_promotion_codes: true,
      success_url: `${BASE_URL}/alerts/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/alerts`,
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('[checkout]', e.message);
    res.status(502).json({ error: 'Checkout didn’t open. Try again in a minute.' });
  }
});

// ---------- Manage (token = secret link) ----------
const byToken = (t) => db.prepare('SELECT * FROM subscribers WHERE token = ?').get(String(t || ''));

app.get('/api/manage/:token', api, (req, res) => {
  const s = byToken(req.params.token);
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json({ email: s.email, phone: s.phone, status: s.status, notify_email: s.notify_email, notify_sms: s.notify_sms,
    categories: s.categories.split(','), zones: db.prepare('SELECT label, address, lat, lng, radius_mi FROM zones WHERE subscriber_id = ?').all(s.id) });
});

app.put('/api/manage/:token', api, (req, res) => {
  const s = byToken(req.params.token);
  if (!s) return res.status(404).json({ error: 'Not found' });
  const { zones, phone, notify_email, notify_sms, categories } = req.body || {};
  const ph = normPhone(phone);
  if (ph === null) return res.status(400).json({ error: 'Enter a 10-digit US mobile number, or leave it blank.' });
  if (notify_sms && !ph) return res.status(400).json({ error: 'Add a mobile number to get text alerts.' });
  if (!notify_email && !notify_sms) return res.status(400).json({ error: 'Choose email, text, or both.' });
  const cats = cleanCats(categories);
  if (!cats.length) return res.status(400).json({ error: 'Choose at least one type of call.' });
  if (!Array.isArray(zones) || !zones.length || zones.length > MAX_ZONES) return res.status(400).json({ error: `Keep between 1 and ${MAX_ZONES} places.` });
  const clean = zones.map((z) => ({ label: String(z.label || '').slice(0, 30), address: String(z.address || '').slice(0, 200), lat: +z.lat, lng: +z.lng, radius: clampR(z.radius) }));
  if (clean.some((z) => !inOrangeCounty(z))) return res.status(400).json({ error: 'Each place must be in Orange County, FL. Tap Find after changing an address.' });

  db.transaction(() => {
    db.prepare('UPDATE subscribers SET phone = ?, notify_email = ?, notify_sms = ?, categories = ? WHERE id = ?')
      .run(ph, notify_email ? 1 : 0, notify_sms ? 1 : 0, cats.join(','), s.id);
    db.prepare('DELETE FROM zones WHERE subscriber_id = ?').run(s.id);
    const ins = db.prepare('INSERT INTO zones (subscriber_id, label, address, lat, lng, radius_mi) VALUES (?, ?, ?, ?, ?, ?)');
    for (const z of clean) ins.run(s.id, z.label, z.address, z.lat, z.lng, z.radius);
  })();
  res.json({ ok: true });
});

app.post('/api/manage/:token/billing', strict, async (req, res) => {
  const s = byToken(req.params.token);
  if (!s) return res.status(404).json({ error: 'Not found' });
  if (!stripe || !s.stripe_customer) return res.status(503).json({ error: 'Billing isn’t available right now.' });
  const portal = await stripe.billingPortal.sessions.create({ customer: s.stripe_customer, return_url: `${BASE_URL}/manage/${s.token}` });
  res.json({ url: portal.url });
});

app.post('/api/manage/resend', strict, async (req, res) => {
  const s = db.prepare('SELECT * FROM subscribers WHERE email = ?').get(String(req.body?.email || '').trim().toLowerCase());
  if (s) sendEmail(s.email, `Your ${SITE_NAME} manage link`, `Change your alert places, radius or alert types, or cancel:\n${BASE_URL}/manage/${s.token}`).catch(() => {});
  res.json({ ok: true }); // same response either way, so emails can't be probed
});

app.use((req, res) => res.status(404).type('html').send(`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><body class="form-page"><main class="doc"><h1>Page not found</h1><p><a href="/">Go to the live map</a></p></main>`));

// ---------- Start ----------
const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`${SITE_NAME} on :${port}. Feeds: ${FEEDS.map((f) => f.agency).join(', ') || 'none configured'}`);
  if (process.env.DISABLE_POLL !== '1') {
    pollFeeds();
    cron.schedule(`*/${POLL_MINUTES} * * * *`, () => pollFeeds());
  }
});
