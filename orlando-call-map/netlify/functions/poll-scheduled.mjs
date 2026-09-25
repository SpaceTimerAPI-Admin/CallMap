// Every 5 minutes: fetch feeds, place calls on the map, send alerts.
// Scheduled functions get 30 seconds; the poller stops at ~24s and finishes leftovers next run.
import { runPoll } from '../../src/ingest.js';

export default async () => {
  await runPoll({ budgetMs: 24_000 });
};
export const config = { schedule: "*/5 * * * *" };
