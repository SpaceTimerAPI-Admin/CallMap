import { tokenForEmail, getSub } from '../../src/store.js';
import { sendEmail } from '../../src/notify.js';
import { json, readJson } from '../../src/http.js';
import { BASE_URL, SITE_NAME } from '../../src/config.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  const email = String((await readJson(req)).email || '').trim().toLowerCase();
  const t = email && (await tokenForEmail(email));
  const s = t && (await getSub(t));
  if (s) await sendEmail(s.email, `Your ${SITE_NAME} manage link`, `Change your alert places, radius or alert types, or cancel:\n${BASE_URL}/manage/${s.token}`).catch(() => {});
  return json({ ok: true }); // same answer either way, so nobody can test which emails are signed up
};
export const config = { path: '/api/resend-link', rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
