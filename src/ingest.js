// Poll feeds -> store new calls -> geocode -> send alerts. Runs in a background function (15-minute limit).
import { FEEDS, fetchFeed, displayAddress } from './feeds.js';
import { geocodeCall } from './geocode.js';
import { processAlerts } from './alerts.js';
import { kv, recentCalls, saveRecentCalls, getState, saveState, pendingStore } from './store.js';

export async function runPoll() {
  const meta = kv('meta');
  const lock = await meta.get('lock', { type: 'json' });
  if (lock && Date.now() - lock.at < 4 * 60_000) { console.log('[poll] previous run still going, skipping'); return { skipped: true }; }
  await meta.setJSON('lock', { at: Date.now() });

  try {
    const state = await getState();
    let recent = await recentCalls();
    const known = new Set(recent.map((c) => c.id));
    const fresh = [];

    for (const feed of FEEDS) {
      try {
        const calls = await fetchFeed(feed);
        state.lastOk[feed.agency] = Date.now();
        delete state.lastError[feed.agency];
        for (const c of calls) {
          if (known.has(c.id)) continue;
          known.add(c.id);
          if (c.lat == null) {
            const p = await geocodeCall(c);
            if (p) { c.lat = p.lat; c.lng = p.lng; }
          }
          const { zip, city, district, ...keep } = c;
          keep.address = displayAddress(keep.address);
          keep.first_seen = Date.now();
          recent.push(keep);
          fresh.push(keep);
        }
      } catch (e) {
        state.lastError[feed.agency] = e.message;
        console.error(`[poll] ${feed.agency}:`, e.message);
      }
      // Save after each feed so the map updates even if a later feed is slow
      recent = recent.filter((c) => c.first_seen > Date.now() - 86_400_000);
      await saveRecentCalls(recent);
    }
    state.lastRun = Date.now();
    await saveState(state);

    // Only alert on calls dispatched recently (avoids an alert burst on the very first run)
    const alertable = fresh.filter((c) => !c.received_at || Date.now() - c.received_at < 20 * 60_000);
    const sent = await processAlerts(alertable);
    console.log(`[poll] new=${fresh.length} alerts=${sent}`);

    // About once an hour, clear abandoned checkouts older than a day
    if (new Date().getMinutes() < 5) {
      const ps = pendingStore();
      const { blobs } = await ps.list();
      for (const b of blobs) {
        const p = await ps.get(b.key, { type: 'json' });
        if (!p || Date.now() - p.created_at > 86_400_000) await ps.delete(b.key);
      }
    }
    return { fresh: fresh.length, sent };
  } finally {
    await meta.delete('lock');
  }
}
