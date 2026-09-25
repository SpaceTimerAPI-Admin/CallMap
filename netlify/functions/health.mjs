import { getState, activeCalls } from '../../src/store.js';
import { FEEDS } from '../../src/feeds.js';
import { json } from '../../src/http.js';

export default async () => {
  const [state, calls] = await Promise.all([getState(), activeCalls()]);
  return json({
    ok: true, lastPoll: state.lastRun ? new Date(state.lastRun).toISOString() : null, activeCalls: calls.length,
    feeds: FEEDS.map((f) => ({ agency: f.agency, lastOk: state.lastOk[f.agency] ? new Date(state.lastOk[f.agency]).toISOString() : null, error: state.lastError[f.agency] || null })),
  });
};
export const config = { path: '/api/health' };
