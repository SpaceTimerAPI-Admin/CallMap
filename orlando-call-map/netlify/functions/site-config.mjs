import { json, cdn } from '../../src/http.js';
import { TILE_URL, TILE_ATTRIBUTION, SUPPORT_MIN, SUPPORT_MAX, SUPPORT_PRESETS } from '../../src/config.js';

export default async () => json({ tileUrl: TILE_URL, tileAttribution: TILE_ATTRIBUTION, supportMin: SUPPORT_MIN, supportMax: SUPPORT_MAX, supportPresets: SUPPORT_PRESETS }, 200, cdn(3600));
export const config = { path: '/api/config' };
