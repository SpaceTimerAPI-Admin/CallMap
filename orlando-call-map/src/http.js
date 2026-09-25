// Response helpers for Netlify Functions.
export const CSP = "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'";

// Google AdSense needs its script, frame and reporting hosts allowed. Used only on pages that can show an ad.
const AD_HOSTS = 'https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.gstatic.com https://*.googleadservices.com https://*.adtrafficquality.google https://fundingchoicesmessages.google.com';
export const AD_CSP = "default-src 'self'; " +
  `script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com ${AD_HOSTS}; ` +
  "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; " +
  `connect-src 'self' ${AD_HOSTS}; frame-src ${AD_HOSTS}; frame-ancestors 'none'`;

// Marks a browser as belonging to an active supporter (checked by /api/ad-free). Set on checkout success and the manage page.
export const supporterCookie = (token) => `ocm_s=${token}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
export const readCookie = (req, name) => {
  const m = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
};

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}

// Cache at Netlify's CDN for a short time so crowds of visitors don't each run a function.
export const cdn = (seconds) => ({
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Netlify-CDN-Cache-Control': `public, max-age=${seconds}, stale-while-revalidate=${seconds}`,
});

export function html(body, status = 200, headers = {}, { ads = false } = {}) {
  return new Response(body, { status, headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': ads ? AD_CSP : CSP, 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin', ...headers } });
}

export async function readJson(req, max = 20_000) {
  const text = await req.text();
  if (text.length > max) throw new Error('Request too large');
  try { return JSON.parse(text || '{}'); } catch { return {}; }
}

export const env = (k, d = '') => process.env[k] ?? d;
