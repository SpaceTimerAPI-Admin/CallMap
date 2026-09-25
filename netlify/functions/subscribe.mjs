import { stripe, newToken } from '../../src/billing.js';
import { geocodeUserAddress } from '../../src/geocode.js';
import { pendingStore, tokenForEmail, getSub } from '../../src/store.js';
import { json, readJson } from '../../src/http.js';
import { validEmail, normPhone, clampRadius, cleanCats } from '../../src/validate.js';
import { BASE_URL, SITE_NAME, SUPPORT_MIN, SUPPORT_MAX } from '../../src/config.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  if (!stripe) return json({ error: 'Payments aren’t set up yet. Add your Stripe key in Netlify.' }, 503);

  const { email, phone, categories, zone, amount } = await readJson(req);
  const dollars = Math.round(Number(amount));
  if (!Number.isFinite(dollars) || dollars < SUPPORT_MIN || dollars > SUPPORT_MAX) return json({ error: `Choose a monthly amount from $${SUPPORT_MIN} to $${SUPPORT_MAX}.` }, 400);
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
  if (!p) return json({ error: 'We couldn’t place that address in the Orlando area.' }, 422);

  const token = newToken();
  await pendingStore().setJSON(token, {
    email: em, phone: ph, categories: cats, amount: dollars, created_at: Date.now(),
    zone: { address: String(zone.address).slice(0, 200), label: String(zone.label || 'Home').slice(0, 30), radius: clampRadius(zone.radius), lat: p.lat, lng: p.lng },
  });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: dollars * 100,
          recurring: { interval: 'month' },
          ...(process.env.STRIPE_PRODUCT_ID
            ? { product: process.env.STRIPE_PRODUCT_ID }
            : { product_data: { name: `${SITE_NAME} monthly support` } }),
        },
      }],
      custom_text: { submit: { message: 'Supporters get address alerts. This is not a charitable donation and is not tax-deductible. Cancel anytime from your manage link.' } },
      customer_email: em,
      metadata: { pending: token },
      subscription_data: { metadata: { pending: token } },
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
