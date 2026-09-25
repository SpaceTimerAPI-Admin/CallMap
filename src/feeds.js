// Fetches and normalizes public "active calls" feeds (XML or JSON) into one shape.
import { XMLParser } from 'fast-xml-parser';
import crypto from 'node:crypto';

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', textNodeName: '_text', parseTagValue: false });

export const FEEDS = [
  { agency: 'OPD', name: 'Orlando Police', category: 'police', city: 'Orlando',
    url: process.env.OPD_FEED_URL ?? 'https://www1.cityoforlando.net/opd/activecalls/activecadpolice.xml' },
  { agency: 'OFD', name: 'Orlando Fire', category: 'medical', city: 'Orlando',
    url: process.env.OFD_FEED_URL ?? 'https://www1.cityoforlando.net/opd/activecalls/activecadfire.xml' },
  { agency: 'OCSO', name: 'Orange County Sheriff', category: 'police', city: '',
    url: process.env.OCSO_FEED_URL || '' },
].filter((f) => f.url);

// Field-name candidates seen across CAD feeds (matched case-insensitively)
const FIELD = {
  id: ['incident', 'incidentnumber', 'incident_number', 'id', 'callnumber', 'call_number', 'eventnumber', 'event', 'cfsnumber', 'casenumber'],
  type: ['desc', 'description', 'type', 'calltype', 'call_type', 'nature', 'incidenttype', 'incident_type', 'problem'],
  address: ['location', 'address', 'block', 'blockaddress', 'street', 'streetaddress'],
  zip: ['zip', 'zipcode', 'zip_code'],
  time: ['date', 'entrytime', 'entry_time', 'calltime', 'call_time', 'received', 'receivedtime', 'datetime', 'dispatchtime', 'createdate', 'time'],
  lat: ['lat', 'latitude'],
  lng: ['lng', 'lon', 'long', 'longitude'],
};

function pick(obj, keys) {
  const lower = {};
  for (const [k, v] of Object.entries(obj)) lower[k.toLowerCase()] = v;
  for (const k of keys) {
    let v = lower[k];
    if (v && typeof v === 'object') v = v._text;
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function findRecords(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 7) return null;
  if (Array.isArray(node)) {
    if (node.length && typeof node[0] === 'object' && pick(node[0], [...FIELD.type, ...FIELD.address])) return node;
    for (const v of node) { const r = findRecords(v, depth + 1); if (r) return r; }
    return null;
  }
  if (pick(node, FIELD.address) && pick(node, FIELD.type)) return [node]; // single record
  for (const v of Object.values(node)) { const r = findRecords(v, depth + 1); if (r) return r; }
  return null;
}

// "9/25/2026 3:14:00 PM" (Eastern) or ISO -> epoch ms
export function parseTime(s) {
  if (!s) return null;
  if (/\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) return Date.parse(s) || null;
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i)
        || s.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?()/);
  if (!m) return null;
  let y, mo, d;
  if (s.includes('/')) { mo = +m[1]; d = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
  else { y = +m[1]; mo = +m[2]; d = +m[3]; }
  let h = +m[4]; const mi = +m[5], sec = +(m[6] || 0), ap = (m[7] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  const guess = Date.UTC(y, mo - 1, d, h, mi, sec);
  const tz = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' })
    .formatToParts(new Date(guess)).find((p) => p.type === 'timeZoneName')?.value || 'GMT-5';
  const off = tz.match(/GMT([+-]\d+)/);
  return guess - (off ? +off[1] : -5) * 3_600_000;
}

const RULES = [
  ['fire', /\b(FIRE|SMOKE|BRUSH|STRUCTURE|EXPLOSION|HAZMAT|GAS LEAK|ODOR|ELECTRICAL)\b/],
  ['police', /\b(SUSPICIOUS|BURGLARY|THEFT|ROBBERY|BATTERY|ASSAULT|SHOT|SHOOTING|DISTURBANCE|TRESPASS|FIGHT|WEAPON|STOLEN|FRAUD|WARRANT|DOMESTIC|NOISE|ALARM|THREAT|PROWLER|NARCOTIC)/],
  ['traffic', /\b(ACCIDENT|CRASH|HIT AND RUN|TRAFFIC|MVA|DUI|ROAD HAZARD|DISABLED VEH|RECKLESS|VEHICLE)/],
  ['medical', /\b(MEDICAL|CARDIAC|SICK|INJUR|OVERDOSE|UNCONSCIOUS|BREATHING|SEIZURE|STROKE|FALL|RESCUE|EMS|DIABETIC|BLEEDING|CHEST PAIN|ALS|BLS|PREGNAN|ALLERG)/],
];
export function categorize(type, fallback) {
  const t = (type || '').toUpperCase();
  for (const [cat, re] of RULES) if (re.test(t)) return cat;
  return fallback;
}

const title = (s) => s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());

export async function fetchFeed(feed) {
  const res = await fetch(feed.url, {
    headers: { 'User-Agent': `${process.env.SITE_NAME || 'Orlando Call Map'} (${process.env.CONTACT_EMAIL || 'admin'})`, Accept: 'application/json, application/xml, text/xml, */*' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${feed.agency} feed HTTP ${res.status}`);
  const text = await res.text();
  const trimmed = text.trim();
  const data = trimmed.startsWith('{') || trimmed.startsWith('[') ? JSON.parse(trimmed) : xml.parse(trimmed);
  const records = findRecords(data) || [];

  return records.map((r) => {
    const type = pick(r, FIELD.type);
    const address = pick(r, FIELD.address);
    const timeRaw = pick(r, FIELD.time);
    const received_at = parseTime(timeRaw);
    const rawId = pick(r, FIELD.id) || crypto.createHash('sha1').update(`${type}|${address}|${timeRaw}`).digest('hex').slice(0, 16);
    const lat = parseFloat(pick(r, FIELD.lat)), lng = parseFloat(pick(r, FIELD.lng));
    return {
      id: `${feed.agency}-${rawId}`,
      agency: feed.agency,
      agency_name: feed.name,
      category: categorize(type, feed.category),
      type: title(type || 'Call for service'),
      address: address.toUpperCase(),
      zip: pick(r, FIELD.zip),
      city: feed.city,
      lat: Number.isFinite(lat) && Math.abs(lat) > 1 ? lat : null,
      lng: Number.isFinite(lng) && Math.abs(lng) > 1 ? lng : null,
      received_at,
    };
  }).filter((c) => c.address);
}
