import { stripe, activateFromSession } from '../../src/billing.js';
import { html } from '../../src/http.js';
import { esc } from '../../src/render.js';
import { SITE_NAME } from '../../src/config.js';

export default async (req) => {
  let sub = null;
  const id = new URL(req.url).searchParams.get('session_id');
  try { if (stripe && id) sub = await activateFromSession(await stripe.checkout.sessions.retrieve(id)); }
  catch (e) { console.error('[success]', e.message); }
  const body = sub
    ? `<h1>Your alerts are on</h1><p>We'll alert you when a call is dispatched inside your area. We also emailed you this link. Bookmark it to change your places or cancel:</p>
       <p><a class="cta" href="/manage/${esc(sub.token)}">Manage my alerts</a></p>`
    : `<h1>Payment received</h1><p>We're finishing setup. Your manage link will arrive by email within a few minutes. If it doesn't, <a href="/manage">request it here</a>.</p>`;
  return html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Alerts on | ${esc(SITE_NAME)}</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;600&display=swap"><link rel="stylesheet" href="/styles.css"></head>
<body class="form-page"><main class="doc">${body}<p><a href="/">Back to live map</a></p></main></body></html>`, 200, { 'Cache-Control': 'no-store' });
};
export const config = { path: '/alerts/success' };
