// GET/PUT /api/manage/:token and POST /api/manage/:token/billing. The token is the secret in the manage link.
import { getSub, saveSub } from '../../src/store.js';
import { stripe } from '../../src/billing.js';
import { json, readJson } from '../../src/http.js';
import { normPhone, clampRadius, cleanCats } from '../../src/validate.js';
import { MAX_ZONES, BASE_URL, inOrangeCounty } from '../../src/config.js';

export default async (req, context) => {
  const s = await getSub(context.params.token);
  if (!s) return json({ error: 'Not found' }, 404);
  const billing = new URL(req.url).pathname.endsWith('/billing');

  if (billing && req.method === 'POST') {
    if (!stripe || !s.stripe_customer) return json({ error: 'Billing isn’t available right now.' }, 503);
    const portal = await stripe.billingPortal.sessions.create({ customer: s.stripe_customer, return_url: `${BASE_URL}/manage/${s.token}` });
    return json({ url: portal.url });
  }

  if (req.method === 'GET') {
    return json({ email: s.email, phone: s.phone, status: s.status, notify_email: s.notify_email, notify_sms: s.notify_sms,
      categories: s.categories, zones: s.zones.map((z) => ({ label: z.label, address: z.address, lat: z.lat, lng: z.lng, radius_mi: z.radius })) });
  }

  if (req.method === 'PUT') {
    const { zones, phone, notify_email, notify_sms, categories } = await readJson(req);
    const ph = normPhone(phone);
    if (ph === null) return json({ error: 'Enter a 10-digit US mobile number, or leave it blank.' }, 400);
    if (notify_sms && !ph) return json({ error: 'Add a mobile number to get text alerts.' }, 400);
    if (!notify_email && !notify_sms) return json({ error: 'Choose email, text, or both.' }, 400);
    const cats = cleanCats(categories);
    if (!cats.length) return json({ error: 'Choose at least one type of call.' }, 400);
    if (!Array.isArray(zones) || !zones.length || zones.length > MAX_ZONES) return json({ error: `Keep between 1 and ${MAX_ZONES} places.` }, 400);
    const clean = zones.map((z) => ({ label: String(z.label || '').slice(0, 30), address: String(z.address || '').slice(0, 200), lat: +z.lat, lng: +z.lng, radius: clampRadius(z.radius) }));
    if (clean.some((z) => !inOrangeCounty(z))) return json({ error: 'Each place must be in the Orlando area. Tap Find after changing an address.' }, 400);
    Object.assign(s, { phone: ph, notify_email: !!notify_email, notify_sms: !!notify_sms, categories: cats, zones: clean });
    await saveSub(s);
    return json({ ok: true });
  }
  return json({ error: 'Method not allowed' }, 405);
};
export const config = { path: ['/api/manage/:token', '/api/manage/:token/billing'], rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
