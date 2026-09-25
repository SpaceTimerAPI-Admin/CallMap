import { activeCalls, getState } from '../../src/store.js';
import { json, cdn } from '../../src/http.js';
import { POLL_MINUTES, ACTIVE_WINDOW_MIN } from '../../src/config.js';

export default async () => {
  const [calls, state] = await Promise.all([activeCalls(), getState()]);
  const step = POLL_MINUTES * 60_000;
  return json({
    serverTime: Date.now(), lastPollAt: state.lastRun || null,
    nextPollAt: Math.ceil(Date.now() / step) * step, windowMin: ACTIVE_WINDOW_MIN,
    calls: calls.map(({ id, agency, agency_name, category, type, address, lat, lng, received_at, first_seen }) =>
      ({ id, agency, agency_name, category, type, address, lat, lng, received_at, first_seen })),
  }, 200, cdn(30));
};

export const config = { path: '/api/calls' };
