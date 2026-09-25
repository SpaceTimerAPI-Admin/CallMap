// Background function (name must end in "-background"). Fetches feeds, geocodes, stores calls, sends alerts.
import { runPoll } from '../../src/ingest.js';

export default async (req) => {
  const secret = process.env.POLL_SECRET;
  if (!secret || req.headers.get('x-poll-secret') !== secret) {
    console.warn('[poll] rejected: missing or wrong POLL_SECRET');
    return;
  }
  const result = await runPoll();
  console.log('[poll] done', JSON.stringify(result));
};
