// Visit /api/poll-now to run a poll immediately and see what happened.
// Always answers within ~20 seconds; if work remains, it keeps going in the background.
import { runPoll } from '../../src/ingest.js';
import { FEEDS } from '../../src/feeds.js';
import { json } from '../../src/http.js';

export default async (req, context) => {
  const report = {};
  const started = Date.now();
  const work = runPoll({ budgetMs: 18_000, report }).catch((e) => { report.error = e.message; });
  context?.waitUntil?.(work);
  const finished = await Promise.race([work.then(() => true), new Promise((r) => setTimeout(() => r(false), 20_000))]);
  if (!finished) report.note = `Still ${report.step || 'working'} after 20s. It will keep going; refresh this page in a minute.`;
  return json({ feedsConfigured: FEEDS.map((f) => f.agency), secondsElapsed: Math.round((Date.now() - started) / 1000), ...report });
};
export const config = { path: '/api/poll-now', rateLimit: { windowLimit: 4, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
