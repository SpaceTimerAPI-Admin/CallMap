// Poll feeds -> store new calls -> geocode -> send alerts -> clean up.
import { db } from './db.js';
import { FEEDS, fetchFeed } from './feeds.js';
import { geocodeCall } from './geocode.js';
import { processAlerts } from './alerts.js';
import { ACTIVE_WINDOW_MS } from './config.js';

export const pollState = { running: false, lastRun: 0, lastOk: {}, lastError: {} };

const exists = db.prepare('SELECT 1 FROM calls WHERE id = ?');
const insert = db.prepare(`INSERT INTO calls (id, agency, agency_name, category, type, address, lat, lng, received_at, first_seen)
  VALUES (@id, @agency, @agency_name, @category, @type, @address, @lat, @lng, @received_at, @first_seen)`);

export async function pollFeeds() {
  if (pollState.running) return;
  pollState.running = true;
  const fresh = [];
  try {
    for (const feed of FEEDS) {
      try {
        const calls = await fetchFeed(feed);
        pollState.lastOk[feed.agency] = Date.now();
        delete pollState.lastError[feed.agency];
        for (const c of calls) {
          if (exists.get(c.id)) continue;
          if (c.lat == null) {
            const p = await geocodeCall(c);
            if (p) { c.lat = p.lat; c.lng = p.lng; }
          }
          c.first_seen = Date.now();
          insert.run(c);
          fresh.push(c);
        }
      } catch (e) {
        pollState.lastError[feed.agency] = e.message;
        console.error(`[poll] ${feed.agency}:`, e.message);
      }
    }
    // Only alert on calls dispatched recently (avoids an alert burst on a fresh database)
    const recent = fresh.filter((c) => !c.received_at || Date.now() - c.received_at < 20 * 60_000);
    const sent = await processAlerts(recent);
    console.log(`[poll] ${new Date().toISOString()} new=${fresh.length} alerts=${sent}`);

    const day = Date.now() - 86_400_000;
    db.prepare('DELETE FROM calls WHERE first_seen < ?').run(day);
    db.prepare('DELETE FROM sent WHERE ts < ?').run(Date.now() - 3 * 86_400_000);
    db.prepare('DELETE FROM pending WHERE created_at < ?').run(day);
  } finally {
    pollState.running = false;
    pollState.lastRun = Date.now();
  }
}

export function activeCalls() {
  return db.prepare('SELECT * FROM calls WHERE first_seen >= ? ORDER BY first_seen DESC').all(Date.now() - ACTIVE_WINDOW_MS);
}
