import { geocodeUserAddress } from '../../src/geocode.js';
import { json, readJson } from '../../src/http.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  const { address } = await readJson(req);
  const p = await geocodeUserAddress(address);
  if (!p) return json({ error: 'We couldn’t place that address in Orange County, FL. Include the street number, street and city.' }, 422);
  return json(p);
};
export const config = { path: '/api/geocode', rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
