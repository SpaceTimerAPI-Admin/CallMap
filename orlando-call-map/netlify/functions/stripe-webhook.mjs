import { stripe, activateFromSession, setStatusByStripeSub } from '../../src/billing.js';

export default async (req) => {
  if (!stripe) return new Response('Stripe not configured', { status: 503 });
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), req.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return new Response(`Webhook error: ${e.message}`, { status: 400 });
  }
  const o = event.data.object;
  if (event.type === 'checkout.session.completed') await activateFromSession(o);
  if (event.type === 'customer.subscription.updated') await setStatusByStripeSub(o.id, o.status);
  if (event.type === 'customer.subscription.deleted') await setStatusByStripeSub(o.id, 'canceled');
  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
};
export const config = { path: '/webhooks/stripe' };
