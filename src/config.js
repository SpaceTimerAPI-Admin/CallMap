export const SITE_NAME = process.env.SITE_NAME || 'Orlando Call Map';
export const BASE_URL = (process.env.BASE_URL || process.env.URL || 'http://localhost:8888').replace(/\/$/, '');
export const POLL_MINUTES = Math.max(1, Number(process.env.POLL_MINUTES || 5));
export const ACTIVE_WINDOW_MIN = 45;
export const ACTIVE_WINDOW_MS = ACTIVE_WINDOW_MIN * 60_000;
export const TILE_URL = process.env.TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = process.env.TILE_ATTRIBUTION || '&copy; OpenStreetMap contributors';

// Orlando-area bounding box (Orange County, FL). Used to reject bad address matches.
export const OC_BBOX = { minLat: 28.34, maxLat: 28.80, minLng: -81.66, maxLng: -80.86 };
export const inOrangeCounty = (p) =>
  !!p && p.lat >= OC_BBOX.minLat && p.lat <= OC_BBOX.maxLat && p.lng >= OC_BBOX.minLng && p.lng <= OC_BBOX.maxLng;

export const CATEGORIES = ['police', 'fire', 'medical', 'traffic'];
export const MAX_ZONES = 3;
export const MIN_RADIUS = 0.25;
export const MAX_RADIUS = 10;

// Area landing pages (internal links + long-tail search terms)
export const AREAS = [
  { slug: 'downtown', name: 'Downtown Orlando', lat: 28.5418, lng: -81.3790, r: 1, zoom: 15 },
  { slug: 'parramore', name: 'Parramore', lat: 28.5395, lng: -81.3905, r: 0.8, zoom: 15 },
  { slug: 'lake-eola-thornton-park', name: 'Lake Eola & Thornton Park', lat: 28.5440, lng: -81.3700, r: 0.8, zoom: 15 },
  { slug: 'mills-50', name: 'Mills 50 & Colonialtown', lat: 28.5560, lng: -81.3620, r: 0.9, zoom: 15 },
  { slug: 'college-park', name: 'College Park', lat: 28.5700, lng: -81.3900, r: 1.2, zoom: 14 },
  { slug: 'audubon-park', name: 'Audubon Park', lat: 28.5680, lng: -81.3500, r: 0.8, zoom: 15 },
  { slug: 'baldwin-park', name: 'Baldwin Park', lat: 28.5660, lng: -81.3280, r: 1, zoom: 15 },
  { slug: 'sodo', name: 'SoDo & Delaney Park', lat: 28.5220, lng: -81.3780, r: 1.2, zoom: 14 },
  { slug: 'metrowest', name: 'MetroWest', lat: 28.5020, lng: -81.4630, r: 1.5, zoom: 14 },
  { slug: 'rosemont', name: 'Rosemont', lat: 28.5970, lng: -81.4250, r: 1, zoom: 15 },
  { slug: 'lake-nona', name: 'Lake Nona', lat: 28.3930, lng: -81.2450, r: 3.5, zoom: 13 },
  { slug: 'airport', name: 'Orlando International Airport', lat: 28.4312, lng: -81.3081, r: 2.5, zoom: 13 },
];

export function miles(a, b) {
  const R = 3958.8, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
