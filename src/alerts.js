// Matches new calls against subscriber alert areas and sends notifications.
import { db } from './db.js';
import { miles, BASE_URL, SITE_NAME } from './config.js';
import { sendEmail, sendSms } from './notify.js';

const fmtTime = (ms) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(ms);
const label = { police: 'Police', fire: 'Fire', medical: 'Medical', traffic: 'Traffic' };

export async function processAlerts(calls) {
  const mappable = calls.filter((c) => c.lat != null);
  if (!mappable.length) return 0;

  const rows = db.prepare(`
    SELECT s.id sid, s.email, s.phone, s.notify_email, s.notify_sms, s.categories, s.token,
           z.label zlabel, z.lat, z.lng, z.radius_mi
    FROM zones z JOIN subscribers s ON s.id = z.subscriber_id
    WHERE s.status IN ('active', 'trialing')`).all();
  const markSent = db.prepare('INSERT OR IGNORE INTO sent (subscriber_id, call_id, ts) VALUES (?, ?, ?)');

  let count = 0;
  for (const call of mappable) {
    for (const r of rows) {
      if (!r.categories.split(',').includes(call.category)) continue;
      const d = miles({ lat: r.lat, lng: r.lng }, call);
      if (d > r.radius_mi) continue;
      if (markSent.run(r.sid, call.id, Date.now()).changes === 0) continue; // already alerted (other zone)

      const where = r.zlabel ? `from ${r.zlabel}` : 'from your alert area';
      const short = `${label[call.category]}: ${call.type} at ${call.address}, ${d.toFixed(1)} mi ${where}. ${fmtTime(call.received_at || call.first_seen)}`;
      const link = `${BASE_URL}/?call=${encodeURIComponent(call.id)}`;
      try {
        if (r.notify_sms && r.phone) await sendSms(r.phone, `${SITE_NAME} ${short} ${link}`);
        if (r.notify_email) {
          await sendEmail(r.email, `${label[call.category]} call ${d.toFixed(1)} mi ${where}`,
            `${short}\n\nAgency: ${call.agency_name}\nView on the map: ${link}\n\nLocations are approximate (block level) as released by the agency. ` +
            `This service is informational only. In an emergency, call 9-1-1.\n\nChange your alert areas: ${BASE_URL}/manage/${r.token}`);
        }
        count++;
      } catch (e) {
        console.error('[alert send failed]', r.email, e.message);
      }
    }
  }
  return count;
}
