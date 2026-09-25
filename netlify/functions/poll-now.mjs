// Visit /api/poll-now to run a poll immediately and see what happened. Useful for setup and troubleshooting.
import { runPoll } from '../../src/ingest.js';
import { FEEDS } from '../../src/feeds.js';
import { json } from '../../src/http.js';

export default async () => {
  const report = await runPoll({ budgetMs: 45_000 });
  return json({ feedsConfigured: FEEDS.map((f) => f.agency), ...report });
};
export const config = { path: '/api/poll-now', rateLimit: { windowLimit: 4, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
