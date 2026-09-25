// Runs every 5 minutes. Scheduled functions are limited to 30 seconds, so it hands the
// real work to the background function (15-minute limit) and returns immediately.
export default async () => {
  const base = (process.env.URL || process.env.BASE_URL || '').replace(/\/$/, '');
  const r = await fetch(`${base}/.netlify/functions/poll-background`, {
    method: 'POST', headers: { 'x-poll-secret': process.env.POLL_SECRET || '' },
  });
  console.log(`[schedule] poll-background -> ${r.status}`);
};
export const config = { schedule: "*/5 * * * *" }; // every 5 minutes (must be a fixed string)
