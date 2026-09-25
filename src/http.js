// Response helpers for Netlify Functions.
export const CSP = "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'";

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}

// Cache at Netlify's CDN for a short time so crowds of visitors don't each run a function.
export const cdn = (seconds) => ({
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Netlify-CDN-Cache-Control': `public, max-age=${seconds}, stale-while-revalidate=${seconds}`,
});

export function html(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin', ...headers } });
}

export async function readJson(req, max = 20_000) {
  const text = await req.text();
  if (text.length > max) throw new Error('Request too large');
  try { return JSON.parse(text || '{}'); } catch { return {}; }
}

export const env = (k, d = '') => process.env[k] ?? d;
