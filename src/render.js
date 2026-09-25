// Server-side rendering so search engines see real content (call lists, area names) without running JS.
import tpl from './template.js';
import { ADSENSE_CLIENT, ADSENSE_SLOT, SITE_NAME, BASE_URL, AREAS, ACTIVE_WINDOW_MIN, POLL_MINUTES, TILE_URL, TILE_ATTRIBUTION, miles } from './config.js';


export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (ms) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(ms);
const CAT = { police: 'Police', fire: 'Fire', medical: 'Medical', traffic: 'Traffic' };

function callItem(c) {
  return `<li class="call" data-id="${esc(c.id)}" data-cat="${esc(c.category)}">
  <span class="call-cat">${CAT[c.category] || 'Call'}</span>
  <strong class="call-type">${esc(c.type)}</strong>
  <span class="call-addr">${esc(c.address)}</span>
  <span class="call-meta">${esc(c.agency_name)}, <time datetime="${new Date(c.received_at || c.first_seen).toISOString()}">${fmt(c.received_at || c.first_seen)}</time></span>
</li>`;
}

export function renderPage({ calls, area }) {
  const list = area ? calls.filter((c) => c.lat != null && miles(area, c) <= area.r) : calls;
  const place = area ? `${area.name}, Orlando, FL` : 'Orlando, FL';
  const title = area
    ? `${area.name} Active Police, Fire & EMS Calls – Live Map | ${SITE_NAME}`
    : `Orlando FL Live Police, Fire & EMS Calls Map | ${SITE_NAME}`;
  const description = area
    ? `Live map of active police, fire, medical and traffic calls in ${area.name}, Orlando, Florida. Updated every ${POLL_MINUTES} minutes from official dispatch feeds. Get alerts for your address.`
    : `See active 911 police, fire, medical and traffic calls across Orlando, Florida on a live map, updated every ${POLL_MINUTES} minutes. Get alerts near your home.`;
  const canonical = area ? `${BASE_URL}/area/${area.slug}` : `${BASE_URL}/`;
  const h1 = area ? `Active calls in ${area.name}` : 'Active calls in Orlando';
  const intro = `Police, fire, medical and traffic calls dispatched in ${place} over the last ${ACTIVE_WINDOW_MIN} minutes, from the Orlando Police and Orlando Fire departments.`;

  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: `${BASE_URL}/` },
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url: canonical,
      about: { '@type': 'Place', name: place, geo: { '@type': 'GeoCoordinates', latitude: area?.lat ?? 28.5384, longitude: area?.lng ?? -81.3789 } } },
    area && { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Orlando', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: area.name, item: canonical } ] },
  ].filter(Boolean);

  const areaLinks = AREAS.map((a) => `<li><a href="/area/${a.slug}"${area?.slug === a.slug ? ' aria-current="page"' : ''}>${esc(a.name)}</a></li>`).join('');
  const now = Date.now();

  const vars = {
    TITLE: esc(title), DESCRIPTION: esc(description), CANONICAL: esc(canonical), SITE_NAME: esc(SITE_NAME),
    H1: esc(h1), INTRO: esc(intro), COUNT: String(list.length),
    CALLS_HTML: list.map(callItem).join('\n') || '<li class="empty">No active calls right now. This list refreshes automatically.</li>',
    AREA_LINKS: areaLinks, AREA_SLUG: esc(area?.slug || ''), AREA_R: String(area?.r || 0),
    LAT: String(area?.lat ?? 28.5100), LNG: String(area?.lng ?? -81.3600), ZOOM: String(area?.zoom ?? 11),
    JSONLD: JSON.stringify(jsonld).replace(/</g, '\\u003c'),
    AD_CLIENT: esc(ADSENSE_CLIENT), AD_SLOT: esc(ADSENSE_SLOT),
    TILE_URL: esc(TILE_URL), TILE_ATTR: esc(TILE_ATTRIBUTION),
    WINDOW_MIN: String(ACTIVE_WINDOW_MIN), POLL_MIN: String(POLL_MINUTES),
    UPDATED_ISO: new Date(now).toISOString(), UPDATED: fmt(now), BASE_URL: esc(BASE_URL),
  };
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

export function renderSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: '/', freq: 'always', pri: '1.0' },
    ...AREAS.map((a) => ({ loc: `/area/${a.slug}`, freq: 'always', pri: '0.8' })),
    { loc: '/alerts', freq: 'monthly', pri: '0.7' },
    { loc: '/terms', freq: 'yearly', pri: '0.2' },
    { loc: '/privacy', freq: 'yearly', pri: '0.2' },
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${BASE_URL}${u.loc}</loc><lastmod>${today}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join('\n')}
</urlset>`;
}
