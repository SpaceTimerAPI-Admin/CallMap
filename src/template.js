// Page template. Placeholders like {{TITLE}} are filled in by render.js.
export default `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{TITLE}}</title>
<meta name="description" content="{{DESCRIPTION}}">
<link rel="canonical" href="{{CANONICAL}}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0F2C3F">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{{SITE_NAME}}">
<meta property="og:title" content="{{TITLE}}">
<meta property="og:description" content="{{DESCRIPTION}}">
<meta property="og:url" content="{{CANONICAL}}">
<meta property="og:image" content="{{BASE_URL}}/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="geo.region" content="US-FL">
<meta name="geo.placename" content="Orlando, Orange County, Florida">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&display=swap">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<link rel="stylesheet" href="/styles.css">
<script type="application/ld+json">{{JSONLD}}</script>
</head>
<body class="map-page" data-lat="{{LAT}}" data-lng="{{LNG}}" data-zoom="{{ZOOM}}" data-area="{{AREA_SLUG}}" data-area-r="{{AREA_R}}"
      data-tiles="{{TILE_URL}}" data-attr="{{TILE_ATTR}}" data-window-min="{{WINDOW_MIN}}" data-poll-min="{{POLL_MIN}}">
<a class="skip" href="#calls">Skip to call list</a>
<header class="topbar">
  <a class="brand" href="/"><svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="17" r="11" fill="#F28C28"/><path d="M16 6c2-3 6-4 8-3-1 3-4 5-8 3z" fill="#57C08B"/><circle cx="16" cy="17" r="4" fill="#0F2C3F"/></svg>{{SITE_NAME}}</a>
  <p class="status" aria-live="polite"><span id="updated">Updated <time datetime="{{UPDATED_ISO}}">{{UPDATED}}</time></span><span id="next">Next update in {{POLL_MIN}}:00</span></p>
  <a class="cta" href="/alerts">Get alerts near you</a>
</header>
<main class="layout">
  <div id="map" role="region" aria-label="Map of active calls"></div>
  <aside class="panel" id="calls">
    <h1>{{H1}}</h1>
    <p class="intro">{{INTRO}}</p>
    <div class="filters" role="group" aria-label="Show call types">
      <button type="button" class="chip" data-cat="police" aria-pressed="true">Police</button>
      <button type="button" class="chip" data-cat="fire" aria-pressed="true">Fire</button>
      <button type="button" class="chip" data-cat="medical" aria-pressed="true">Medical</button>
      <button type="button" class="chip" data-cat="traffic" aria-pressed="true">Traffic</button>
    </div>
    <p class="count"><span id="count">{{COUNT}}</span> active calls. Each drops off {{WINDOW_MIN}} minutes after it appears.</p>
    <ol class="call-list" id="call-list">
{{CALLS_HTML}}
    </ol>
    <section class="pitch">
      <h2>Know when something happens on your street</h2>
      <p>Pick an address and a radius. We'll text or email you when police, fire or rescue is dispatched inside it. $10 a month, cancel anytime.</p>
      <a class="cta" href="/alerts">Set up alerts</a>
    </section>
    <nav class="areas" aria-label="Neighborhoods">
      <h2>Calls by area</h2>
      <ul>{{AREA_LINKS}}</ul>
    </nav>
    <footer class="fine">
      <p>Locations are approximate and shown as released by each agency. Not affiliated with the Orange County Sheriff's Office or the City of Orlando. For emergencies, call 9-1-1.</p>
      <p><a href="/terms">Terms</a> <a href="/privacy">Privacy</a> <a href="/manage">Manage my alerts</a></p>
    </footer>
  </aside>
</main>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script src="/app.js"></script>
</body>
</html>
`;
