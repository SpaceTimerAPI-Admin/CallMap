import { renderSitemap } from '../../src/render.js';
import { BASE_URL } from '../../src/config.js';
import { cdn } from '../../src/http.js';

export default async (req) => {
  if (new URL(req.url).pathname === '/robots.txt') {
    return new Response(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /manage\nDisallow: /alerts/success\n\nSitemap: ${BASE_URL}/sitemap.xml\n`,
      { headers: { 'Content-Type': 'text/plain; charset=utf-8', ...cdn(3600) } });
  }
  return new Response(renderSitemap(), { headers: { 'Content-Type': 'application/xml; charset=utf-8', ...cdn(3600) } });
};
export const config = { path: ['/robots.txt', '/sitemap.xml'] };
