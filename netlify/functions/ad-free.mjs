// Tells the page whether to skip ads: true only for a browser marked as an active supporter.
import { getSub } from '../../src/store.js';
import { json, readCookie } from '../../src/http.js';

export default async (req) => {
  const token = readCookie(req, 'ocm_s');
  const s = token && (await getSub(token));
  const adFree = !!s && ['active', 'trialing', 'past_due'].includes(s.status);
  return json({ adFree }, 200, { 'Cache-Control': 'private, no-store', 'Netlify-CDN-Cache-Control': 'no-store', Vary: 'Cookie' });
};
export const config = { path: '/api/ad-free' };
