// Matches new calls against subscriber alert areas and sends notifications.
import { miles, BASE_URL, SITE_NAME } from './config.js';
import { activeSubscribers } from './store.js';
import { sendEmail, sendSms } from './notify.js';

const fmtTime = (ms) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(ms);
const LABEL = { police: 'Police', fire: 'Fire', medical: 'Medical', traffic: 'Traffic' };

export async function processAlerts(calls) {
  const mappable = calls.filter((c) => c.lat != null);
  if (!mappable.length) return 0;
  const subs = await activeSubscribers();
  if (!subs.length) return 0;

  const jobs = [];
  for (const call of mappable) {
    for (const s of subs) {
      if (!s.categories.includes(call.category)) continue;
      // nearest matching zone (one alert per subscriber per call, even with overlapping zones)
      let best = null;
      for (const z of s.zones) {
        const d = miles(z, call);
        if (d <= z.radius && (!best || d < best.d)) best = { d, z };
      }
      if (!best) continue;
      const where = best.z.label ? `from ${best.z.label}` : 'from your alert area';
      const line = `${LABEL[call.category]}: ${call.type} at ${call.address}, ${best.d.toFixed(1)} mi ${where}. ${fmtTime(call.received_at || call.first_seen)}`;
      const link = `${BASE_URL}/?call=${encodeURIComponent(call.id)}`;
      jobs.push((async () => {
        try {
          if (s.notify_sms && s.phone) await sendSms(s.phone, `${SITE_NAME} ${line} ${link}`);
          if (s.notify_email) {
            await sendEmail(s.email, `${LABEL[call.category]} call ${best.d.toFixed(1)} mi ${where}`,
              `${line}\n\nAgency: ${call.agency_name}\nView on the map: ${link}\n\n` +
              `Locations are approximate (block level) as released by the agency. This service is informational only. In an emergency, call 9-1-1.\n\n` +
              `Change your alert areas: ${BASE_URL}/manage/${s.token}`);
          }
          return 1;
        } catch (e) { console.error('[alert send failed]', s.email, e.message); return 0; }
      })());
    }
  }
  return (await Promise.all(jobs)).reduce((a, b) => a + b, 0);
}
