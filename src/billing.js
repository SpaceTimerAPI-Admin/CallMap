import Stripe from 'stripe';
import crypto from 'node:crypto';
import { db } from './db.js';
import { BASE_URL, SITE_NAME } from './config.js';
import { sendEmail } from './notify.js';

export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const newToken = () => crypto.randomBytes(24).toString('base64url');

// Idempotent: called from the webhook and from the success page, whichever comes first.
export async function activateFromSession(session) {
  if (!session || session.mode !== 'subscription' || !['complete'].includes(session.status)) return null;
  const pendingToken = session.metadata?.pending;
  const existingBySub = session.subscription && db.prepare('SELECT * FROM subscribers WHERE stripe_sub = ?').get(session.subscription);
  if (existingBySub) return existingBySub;

  const pending = pendingToken && db.prepare('SELECT * FROM pending WHERE token = ?').get(pendingToken);
  if (!pending) return null;
  const data = JSON.parse(pending.data);

  const tx = db.transaction(() => {
    let sub = db.prepare('SELECT * FROM subscribers WHERE email = ?').get(data.email);
    if (sub) {
      db.prepare(`UPDATE subscribers SET phone=?, stripe_customer=?, stripe_sub=?, status='active', notify_sms=?, categories=? WHERE id=?`)
        .run(data.phone, session.customer, session.subscription, data.sms ? 1 : 0, data.categories, sub.id);
      db.prepare('DELETE FROM zones WHERE subscriber_id = ?').run(sub.id);
    } else {
      const info = db.prepare(`INSERT INTO subscribers (email, phone, token, stripe_customer, stripe_sub, status, notify_email, notify_sms, categories, created_at)
        VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?, ?)`)
        .run(data.email, data.phone, newToken(), session.customer, session.subscription, data.sms ? 1 : 0, data.categories, Date.now());
      sub = { id: info.lastInsertRowid };
    }
    const z = data.zone;
    db.prepare('INSERT INTO zones (subscriber_id, label, address, lat, lng, radius_mi) VALUES (?, ?, ?, ?, ?, ?)')
      .run(sub.id, z.label, z.address, z.lat, z.lng, z.radius);
    db.prepare('DELETE FROM pending WHERE token = ?').run(pendingToken);
    return db.prepare('SELECT * FROM subscribers WHERE id = ?').get(sub.id);
  });
  const sub = tx();

  sendEmail(sub.email, `Your ${SITE_NAME} alerts are on`,
    `You'll get an alert when a police, fire, medical or traffic call is dispatched inside your alert area.\n\n` +
    `Save this link to change your address, radius, or alert types, or to cancel:\n${BASE_URL}/manage/${sub.token}\n\n` +
    `This service is informational only and can be delayed by several minutes. In an emergency, call 9-1-1.`).catch(() => {});
  return sub;
}

export function setStatusBySub(subId, status) {
  db.prepare('UPDATE subscribers SET status = ? WHERE stripe_sub = ?').run(status, subId);
}
