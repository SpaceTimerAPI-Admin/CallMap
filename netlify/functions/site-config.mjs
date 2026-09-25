import { json, cdn } from '../../src/http.js';
import { TILE_URL, TILE_ATTRIBUTION } from '../../src/config.js';

export default async () => json({ tileUrl: TILE_URL, tileAttribution: TILE_ATTRIBUTION }, 200, cdn(3600));
export const config = { path: '/api/config' };
