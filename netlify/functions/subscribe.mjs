import { stripe, newToken } from '../../src/billing.js';
import { geocodeUserAddress } from '../../src/geocode.js';
import { pendingStore, tokenForEmail, getSub } from '../../src/store.js';
import { json, readJson } from '../../src/http.js';
import { validEmail, normPhone, clampRadius, cleanCats } from '../../src/validate.js';
import { BASE_URL } from '../../src/config.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  if (!stripe || !process.env.STRIPE_PRICE_ID) return json({ error: 'Payments aren’t set up yet. Add your Stripe keys in Netlify.' }, 503);

  const { email, phone, categories, zone } = await readJson(req);
  const em = String(email || '').trim().toLowerCase();
  if (!validEmail(em)) return json({ error: 'Enter a valid email address.' }, 400);
  const ph = normPhone(phone);
  if (ph === null) return json({ error: 'Enter a 10-digit US mobile number, or leave it blank.' }, 400);
  const cats = cleanCats(categories);
  if (!cats.length) return json({ error: 'Choose at least one type of call.' }, 400);

  const existingToken = await tokenForEmail(em);
  const existing = existingToken && (await getSub(existingToken));
  if (existing && ['active', 'trialing', 'past_due'].includes(existing.status)) {
    return json({ error: 'This email already has alerts. Use your manage link to add places, or request it at /manage.' }, 409);
  }

  const p = await geocodeUserAddress(zone?.address);
  if (!p) return json({ error: 'We couldn’t place that address in Orange County, FL.' }, 422);

  const token = newToken();
  await pendingStore().setJSON(token, {
    email: em, phone: ph, categories: cats, created_at: Date.now(),
    zone: { address: String(zone.address).slice(0, 200), label: String(zone.label || 'Home').slice(0, 30), radius: clampRadius(zone.radius), lat: p.lat, lng: p.lng },
  });

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
    return json({ url: session.url });
  } catch (e) {
    console.error('[checkout]', e.message);
    return json({ error: 'Checkout didn’t open. Try again in a minute.' }, 502);
  }
};
export const config = { path: '/api/subscribe', rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
