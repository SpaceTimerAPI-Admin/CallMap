// Server-rendered map pages: "/" and "/area/:slug" (so search engines see the live call list)
import { renderPage } from '../../src/render.js';
import { activeCalls } from '../../src/store.js';
import { AREAS, ADSENSE_CLIENT } from '../../src/config.js';
import { html, cdn } from '../../src/http.js';

export default async (req, context) => {
  const slug = context.params?.slug;
  const area = slug ? AREAS.find((a) => a.slug === slug) : null;
  if (slug && !area) return Response.redirect(new URL('/', req.url), 302);
  return html(renderPage({ calls: await activeCalls(), area }), 200, cdn(60), { ads: !!ADSENSE_CLIENT });
};

export const config = { path: ['/', '/area/:slug'] };
