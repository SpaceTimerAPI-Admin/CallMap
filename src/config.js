export const SITE_NAME = process.env.SITE_NAME || 'Orlando Call Map';
export const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const POLL_MINUTES = Math.max(1, Number(process.env.POLL_MINUTES || 5));
export const ACTIVE_WINDOW_MIN = 45;
export const ACTIVE_WINDOW_MS = ACTIVE_WINDOW_MIN * 60_000;
export const TILE_URL = process.env.TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = process.env.TILE_ATTRIBUTION || '&copy; OpenStreetMap contributors';

// Orange County, FL bounding box
export const OC_BBOX = { minLat: 28.34, maxLat: 28.80, minLng: -81.66, maxLng: -80.86 };
export const inOrangeCounty = (p) =>
  !!p && p.lat >= OC_BBOX.minLat && p.lat <= OC_BBOX.maxLat && p.lng >= OC_BBOX.minLng && p.lng <= OC_BBOX.maxLng;

export const CATEGORIES = ['police', 'fire', 'medical', 'traffic'];
export const MAX_ZONES = 3;
export const MIN_RADIUS = 0.25;
export const MAX_RADIUS = 10;

// Area landing pages (internal links + long-tail search terms)
export const AREAS = [
  { slug: 'orlando', name: 'Orlando', lat: 28.5384, lng: -81.3789, r: 6, zoom: 12 },
  { slug: 'winter-park', name: 'Winter Park', lat: 28.6000, lng: -81.3392, r: 2.5, zoom: 13 },
  { slug: 'apopka', name: 'Apopka', lat: 28.6934, lng: -81.5322, r: 4, zoom: 13 },
  { slug: 'ocoee', name: 'Ocoee', lat: 28.5692, lng: -81.5440, r: 3, zoom: 13 },
  { slug: 'winter-garden', name: 'Winter Garden', lat: 28.5653, lng: -81.5862, r: 3.5, zoom: 13 },
  { slug: 'maitland', name: 'Maitland', lat: 28.6278, lng: -81.3631, r: 2, zoom: 14 },
  { slug: 'windermere', name: 'Windermere', lat: 28.4956, lng: -81.5348, r: 3, zoom: 13 },
  { slug: 'pine-hills', name: 'Pine Hills', lat: 28.5578, lng: -81.4534, r: 2.5, zoom: 13 },
  { slug: 'dr-phillips', name: 'Dr. Phillips', lat: 28.4494, lng: -81.4923, r: 3, zoom: 13 },
  { slug: 'lake-nona', name: 'Lake Nona', lat: 28.3930, lng: -81.2450, r: 4, zoom: 13 },
  { slug: 'ucf-area', name: 'UCF area', lat: 28.6024, lng: -81.2001, r: 3, zoom: 13 },
  { slug: 'union-park', name: 'Union Park', lat: 28.5683, lng: -81.2851, r: 3, zoom: 13 },
  { slug: 'azalea-park', name: 'Azalea Park', lat: 28.5411, lng: -81.3001, r: 2, zoom: 14 },
  { slug: 'conway', name: 'Conway', lat: 28.5028, lng: -81.3306, r: 2, zoom: 14 },
  { slug: 'belle-isle', name: 'Belle Isle', lat: 28.4583, lng: -81.3592, r: 2, zoom: 14 },
];

export function miles(a, b) {
  const R = 3958.8, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
