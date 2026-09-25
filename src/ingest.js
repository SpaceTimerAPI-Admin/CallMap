// Poll feeds -> save new calls -> place them on the map -> send alerts.
// Runs inside Netlify's scheduled function (30-second limit), so it works against a time budget:
// calls are saved right away, and any addresses not located in time are finished on the next run.
import { FEEDS, fetchFeed, displayAddress } from './feeds.js';
import { geocodeCall } from './geocode.js';
import { processAlerts } from './alerts.js';
import { kv, recentCalls, saveRecentCalls, getState, saveState, pendingStore } from './store.js';

export async function runPoll({ budgetMs = 24_000 } = {}) {
  const start = Date.now();
  const timeLeft = () => budgetMs - (Date.now() - start);
  const meta = kv('meta');
  const lock = await meta.get('lock', { type: 'json' });
  if (lock && Date.now() - lock.at < 60_000) return { skipped: 'another poll is running' };
  await meta.setJSON('lock', { at: Date.now() });

  const report = { feeds: {}, newCalls: 0, placedOnMap: 0, waitingForLocation: 0, alertsSent: 0 };
  try {
    const state = await getState();
    let recent = await recentCalls();
    const known = new Set(recent.map((c) => c.id));

    // 1. Fetch every feed at once
    const results = await Promise.allSettled(FEEDS.map((f) => fetchFeed(f)));
    results.forEach((r, i) => {
      const feed = FEEDS[i];
      if (r.status === 'rejected') {
        state.lastError[feed.agency] = r.reason?.message || String(r.reason);
        report.feeds[feed.agency] = { ok: false, error: state.lastError[feed.agency] };
        return;
      }
      state.lastOk[feed.agency] = Date.now();
      delete state.lastError[feed.agency];
      report.feeds[feed.agency] = { ok: true, callsInFeed: r.value.length };
      for (const c of r.value) {
        if (known.has(c.id)) continue;
        known.add(c.id);
        recent.push({ ...c, raw_address: c.address, address: displayAddress(c.address), first_seen: Date.now(), geo: c.lat != null ? 'ok' : 'todo', alerted: false });
        report.newCalls++;
      }
    });
    recent = recent.filter((c) => c.first_seen > Date.now() - 86_400_000);
    await saveRecentCalls(recent); // list shows up immediately, even before pins are placed

    // 2. Place calls on the map, newest first, until the time budget runs out
    const todo = recent.filter((c) => c.geo === 'todo').sort((a, b) => b.first_seen - a.first_seen);
    for (const c of todo) {
      if (timeLeft() < 6_000) break;
      const p = await geocodeCall({ address: c.raw_address, zip: c.zip, city: c.city, district: c.district });
      if (p === false) { c.tries = (c.tries || 0) + 1; if (c.tries >= 4) c.geo = 'none'; continue; } // temporary failure: retry next run, give up after 4
      if (p) { c.lat = p.lat; c.lng = p.lng; c.geo = 'ok'; report.placedOnMap++; } else c.geo = 'none';
    }
    report.waitingForLocation = recent.filter((c) => c.geo === 'todo').length;
    await saveRecentCalls(recent);
    state.lastRun = Date.now();
    await saveState(state);

    // 3. Alerts: each call once, as soon as it has a location, only if dispatched recently
    const ready = recent.filter((c) => !c.alerted && c.geo !== 'todo');
    const alertable = ready.filter((c) => c.lat != null && (!c.received_at || Date.now() - c.received_at < 20 * 60_000));
    ready.forEach((c) => { c.alerted = true; });
    if (ready.length) await saveRecentCalls(recent);
    if (alertable.length && timeLeft() > 2_000) report.alertsSent = await processAlerts(alertable);

    // 4. About once an hour, clear abandoned checkouts older than a day
    if (new Date().getMinutes() < 5 && timeLeft() > 3_000) {
      const ps = pendingStore();
      const { blobs } = await ps.list();
      for (const b of blobs) {
        const p = await ps.get(b.key, { type: 'json' });
        if (!p || Date.now() - p.created_at > 86_400_000) await ps.delete(b.key);
      }
    }
    report.seconds = Math.round((Date.now() - start) / 100) / 10;
    console.log('[poll]', JSON.stringify(report));
    return report;
  } finally {
    await meta.delete('lock');
  }
}
