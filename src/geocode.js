// Address -> lat/lng. Street addresses: US Census geocoder, then OpenStreetMap Nominatim.
// Intersections ("COLONIAL DR / MILLS AV"): OpenStreetMap Overpass (finds the node both roads share).
import { geoStore, hash } from './store.js';
import { OC_BBOX, inOrangeCounty } from './config.js';

const UA = `${process.env.SITE_NAME || 'Orlando Call Map'} (${process.env.CONTACT_EMAIL || 'admin@example.com'})`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SUFFIX = { AV: 'Avenue', AVE: 'Avenue', DR: 'Drive', ST: 'Street', RD: 'Road', BLVD: 'Boulevard', BL: 'Boulevard',
  LN: 'Lane', CT: 'Court', PKWY: 'Parkway', PKY: 'Parkway', HWY: 'Highway', TRL: 'Trail', TR: 'Trail', CIR: 'Circle',
  PL: 'Place', WY: 'Way', TER: 'Terrace', PT: 'Point', XING: 'Crossing', LOOP: 'Loop', RUN: 'Run', SQ: 'Square' };
const DIR = { N: 'North', S: 'South', E: 'East', W: 'West' };

export function cleanAddress(raw) {
  let a = String(raw || '').toUpperCase().trim();
  const range = a.match(/^\[\s*(\d+)\s*-\s*(\d+)\s*\]\s*(.+)$/);
  if (range) {
    const lo = +range[1], hi = +range[2];
    const mid = Math.max(1, Math.round((lo + hi) / 2 / 100) * 100);
    a = `${mid} ${range[3]}`;
  }
  if (/^\[\s*UNK\s*\]/.test(a)) return ''; // street only, no block: a pin could be miles off, so list it without a pin
  return a
    .replace(/\bBLOCK OF\b|\bBLK\b|\bBLOCK\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function streetCore(s) {
  // "E COLONIAL DR" -> "Colonial Drive" (direction dropped; OSM names vary)
  const parts = s.trim().split(' ').filter(Boolean);
  if (parts.length > 1 && DIR[parts[0]]) parts.shift();
  if (parts.length > 1 && DIR[parts[parts.length - 1]]) parts.pop();
  const last = parts[parts.length - 1];
  if (SUFFIX[last]) parts[parts.length - 1] = SUFFIX[last];
  return parts.join(' ').replace(/\b(\w)(\w*)/g, (_, a, b) => a + b.toLowerCase());
}
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\"]/g, '\\$&');

async function census(oneLine) {
  const u = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');
  u.search = new URLSearchParams({ address: oneLine, benchmark: 'Public_AR_Current', format: 'json' });
  const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) return null;
  const m = (await r.json())?.result?.addressMatches?.[0];
  return m ? { lat: m.coordinates.y, lng: m.coordinates.x } : null;
}

let lastOsm = 0;
async function osmThrottle() { const wait = 1100 - (Date.now() - lastOsm); if (wait > 0) await sleep(wait); lastOsm = Date.now(); }

async function nominatim(q) {
  await osmThrottle();
  const u = new URL('https://nominatim.openstreetmap.org/search');
  u.search = new URLSearchParams({ q, format: 'json', limit: '1', countrycodes: 'us', bounded: '1',
    viewbox: `${OC_BBOX.minLng},${OC_BBOX.maxLat},${OC_BBOX.maxLng},${OC_BBOX.minLat}` });
  const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) return null;
  const j = await r.json();
  return j[0] ? { lat: +j[0].lat, lng: +j[0].lon } : null;
}

async function intersection(a, b) {
  await osmThrottle();
  const bb = `${OC_BBOX.minLat},${OC_BBOX.minLng},${OC_BBOX.maxLat},${OC_BBOX.maxLng}`;
  const q = `[out:json][timeout:20];
way["highway"]["name"~"${reEsc(streetCore(a))}",i](${bb})->.a;
way["highway"]["name"~"${reEsc(streetCore(b))}",i](${bb})->.b;
node(w.a)(w.b);out 1;`;
  const r = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(25_000),
  });
  if (!r.ok) return null;
  const n = (await r.json())?.elements?.[0];
  return n ? { lat: n.lat, lng: n.lon } : null;
}

function expandForSearch(addr) {
  return addr.split(' ').map((w) => SUFFIX[w] || w).join(' ');
}

// Geocode a dispatch location (block address or intersection)
export async function geocodeCall({ address, zip, city, district }) {
  if (!city && /^APK/i.test(district || '')) city = 'Apopka';
  const addr = cleanAddress(address);
  if (!addr) return null;
  const key = `${addr}|${zip || city || ''}`;
  const cache = geoStore();
  const hit = await cache.get(hash(key), { type: 'json' });
  if (hit && (hit.lat != null || Date.now() - hit.ts < 86_400_000)) return hit.lat != null ? { lat: hit.lat, lng: hit.lng } : null;

  let p = null;
  try {
    const parts = addr.split(/\s*(?:\/|&|\bAND\b|@)\s*/).filter(Boolean);
    if (parts.length >= 2) {
      p = await intersection(parts[0].replace(/^\d+\s+/, ''), parts[1]);
    } else {
      const where = zip ? `FL ${zip}` : `${city || 'Orlando'}, FL`;
      p = await census(`${addr}, ${where}`);
      if (!p) p = await nominatim(`${expandForSearch(addr)}, ${city || 'Orange County'}, Florida`);
    }
  } catch (e) {
    console.warn('[geocode]', addr, e.message);
    return null; // don't cache network errors
  }
  if (!inOrangeCounty(p)) p = null;
  await cache.setJSON(hash(key), { lat: p?.lat ?? null, lng: p?.lng ?? null, ts: Date.now() });
  return p;
}

// Geocode a subscriber's full address
export async function geocodeUserAddress(address) {
  const a = String(address || '').trim().slice(0, 200);
  if (a.length < 5) return null;
  const withState = /\bFL\b|FLORIDA/i.test(a) ? a : `${a}, FL`;
  let p = await census(withState).catch(() => null);
  if (!p) p = await nominatim(withState).catch(() => null);
  return inOrangeCounty(p) ? p : null;
}
