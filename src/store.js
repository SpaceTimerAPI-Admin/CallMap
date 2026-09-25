// All persistent data lives in Netlify Blobs (built into every Netlify site; no database to set up).
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import { ACTIVE_WINDOW_MS } from './config.js';

export const kv = (name) => getStore({ name, consistency: 'strong' });
export const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 40);
export const validToken = (t) => typeof t === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(t);

// ---- Calls: one JSON list of everything seen in the last 24 hours (small; single writer = the poller)
export async function recentCalls() {
  return (await kv('calls').get('recent', { type: 'json' })) || [];
}
export async function saveRecentCalls(list) {
  await kv('calls').setJSON('recent', list);
}
export async function activeCalls() {
  const cutoff = Date.now() - ACTIVE_WINDOW_MS;
  return (await recentCalls()).filter((c) => c.first_seen >= cutoff).sort((a, b) => b.first_seen - a.first_seen);
}

// ---- Poller status
export const getState = async () => (await kv('meta').get('state', { type: 'json' })) || { lastRun: 0, lastOk: {}, lastError: {} };
export const saveState = (s) => kv('meta').setJSON('state', s);

// ---- Subscribers. Record: { token, email, phone, status, stripe_customer, stripe_sub,
//      notify_email, notify_sms, categories: [], zones: [{label,address,lat,lng,radius}], created_at }
const subs = () => kv('subscribers');
export const getSub = async (token) => (validToken(token) ? subs().get(`sub/${token}`, { type: 'json' }) : null);
export const saveSub = (s) => subs().setJSON(`sub/${s.token}`, s);
export const tokenForEmail = (email) => subs().get(`email/${hash(email.toLowerCase())}`);
export const linkEmail = (email, token) => subs().set(`email/${hash(email.toLowerCase())}`, token);
export const tokenForStripeSub = (id) => subs().get(`stripe/${hash(id)}`);
export const linkStripeSub = (id, token) => subs().set(`stripe/${hash(id)}`, token);

export async function activeSubscribers() {
  const s = subs();
  const { blobs } = await s.list({ prefix: 'sub/' });
  const all = await Promise.all(blobs.map((b) => s.get(b.key, { type: 'json' })));
  return all.filter((x) => x && ['active', 'trialing'].includes(x.status));
}

// ---- Signups waiting on Stripe checkout
export const pendingStore = () => kv('pending');

// ---- Geocoding cache
export const geoStore = () => kv('geocache');
