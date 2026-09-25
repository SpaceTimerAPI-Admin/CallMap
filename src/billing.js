import Stripe from 'stripe';
import crypto from 'node:crypto';
import { BASE_URL, SITE_NAME } from './config.js';
import { sendEmail } from './notify.js';
import { pendingStore, getSub, saveSub, tokenForEmail, linkEmail, tokenForStripeSub, linkStripeSub } from './store.js';

export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
export const newToken = () => crypto.randomBytes(24).toString('base64url');

// Idempotent: runs from both the Stripe webhook and the success page; whichever lands first does the work.
export async function activateFromSession(session) {
  if (!session || session.mode !== 'subscription' || session.status !== 'complete') return null;
  if (session.subscription) {
    const t = await tokenForStripeSub(session.subscription);
    if (t) { const s = await getSub(t); if (s) return s; }
  }
  const pendingToken = session.metadata?.pending;
  if (!pendingToken) return null;
  const pend = await pendingStore().get(pendingToken, { type: 'json' });
  if (!pend) return null;

  // Reuse an existing manage link for returning customers; otherwise the pending token becomes the manage token.
  // Both paths compute the same token, so a webhook/success-page race writes the same record twice (harmless).
  const token = (await tokenForEmail(pend.email)) || pendingToken;
  const prev = await getSub(token);
  const sub = {
    token, email: pend.email, phone: pend.phone, status: 'active',
    stripe_customer: session.customer, stripe_sub: session.subscription,
    notify_email: true, notify_sms: !!pend.phone, categories: pend.categories,
    zones: [pend.zone], created_at: prev?.created_at || Date.now(),
  };
  await saveSub(sub);
  await linkEmail(sub.email, token);
  if (session.subscription) await linkStripeSub(session.subscription, token);

  if (!prev || prev.status !== 'active') {
    await sendEmail(sub.email, `Your ${SITE_NAME} alerts are on`,
      `You'll get an alert when a police, fire, medical or traffic call is dispatched inside your alert area.\n\n` +
      `Save this link to change your address, radius or alert types, or to cancel:\n${BASE_URL}/manage/${token}\n\n` +
      `Alerts can be delayed by several minutes. In an emergency, call 9-1-1.`).catch(() => {});
  }
  await pendingStore().delete(pendingToken);
  return sub;
}

export async function setStatusByStripeSub(stripeSubId, status) {
  const t = await tokenForStripeSub(stripeSubId);
  const s = t && (await getSub(t));
  if (s) { s.status = status; await saveSub(s); }
}
