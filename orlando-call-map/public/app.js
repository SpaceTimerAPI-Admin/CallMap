(() => {
  const b = document.body.dataset;
  const WINDOW_MS = +b.windowMin * 60_000;
  const POLL_MS = +b.pollMin * 60_000;
  const COLOR = { police: '#2F6FD0', fire: '#E0442C', medical: '#D9A400', traffic: '#2E9E66' };
  const LABEL = { police: 'Police', fire: 'Fire', medical: 'Medical', traffic: 'Traffic' };
  const area = b.area ? { lat: +b.lat, lng: +b.lng, r: +b.areaR } : null;

  const map = L.map('map', { zoomControl: true }).setView([+b.lat, +b.lng], +b.zoom);
  L.tileLayer(b.tiles, { maxZoom: 19, attribution: b.attr }).addTo(map);
  if (area) L.circle([area.lat, area.lng], { radius: area.r * 1609.34, color: '#0F2C3F', weight: 1, dashArray: '4 6', fill: false, interactive: false }).addTo(map);

  const listEl = document.getElementById('call-list');
  const countEl = document.getElementById('count');
  const nextEl = document.getElementById('next');
  const updatedEl = document.getElementById('updated');
  const shown = new Set(['police', 'fire', 'medical', 'traffic']);
  const markers = new Map();
  let calls = [];
  let offset = 0;
  let nextAt = Date.now() + POLL_MS;
  let selected = new URLSearchParams(location.search).get('call');
  let firstLoad = true;

  const now = () => Date.now() + offset;
  const life = (c) => Math.max(0, 1 - (now() - c.first_seen) / WINDOW_MS);
  const fmt = (ms) => new Date(ms).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
  const ago = (ms) => { const m = Math.floor((now() - ms) / 60_000); return m < 1 ? 'just now' : `${m} min ago`; };
  const miles = (a, c) => {
    const R = 3958.8, r = (d) => d * Math.PI / 180;
    const h = Math.sin(r(c.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(c.lat)) * Math.sin(r(c.lng - a.lng) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  function popup(c) {
    const el = document.createElement('div');
    const dot = document.createElement('span'); dot.className = 'pop-dot'; dot.style.background = COLOR[c.category];
    const t = document.createElement('span'); t.className = 'pop-type'; t.textContent = c.type;
    const a = document.createElement('div'); a.textContent = c.address;
    const m = document.createElement('div'); m.className = 'pop-meta';
    m.append(dot, `${LABEL[c.category]}, ${c.agency_name}. Dispatched ${fmt(c.received_at || c.first_seen)}`);
    el.append(t, a, m);
    return el;
  }

  function visible() {
    return calls.filter((c) => life(c) > 0 && shown.has(c.category) && (!area || (c.lat != null && miles(area, c) <= area.r)));
  }

  function draw() {
    const live = visible();
    const ids = new Set(live.map((c) => c.id));

    for (const [id, m] of markers) if (!ids.has(id)) { m.remove(); markers.delete(id); }
    for (const c of live) {
      if (c.lat == null) continue;
      const f = life(c);
      const style = { radius: 6 + 5 * f, color: '#ffffff', weight: 1.5, fillColor: COLOR[c.category], fillOpacity: 0.3 + 0.65 * f, opacity: 0.5 + 0.5 * f };
      let m = markers.get(c.id);
      if (m) { m.setStyle(style); m.setRadius(style.radius); }
      else {
        m = L.circleMarker([c.lat, c.lng], style).bindPopup(() => popup(c)).addTo(map);
        m.on('click', () => select(c.id, false));
        markers.set(c.id, m);
      }
    }

    listEl.replaceChildren(...(live.length ? live.map(item) : [emptyItem()]));
    countEl.textContent = live.length;
  }

  function item(c) {
    const li = document.createElement('li');
    li.className = 'call' + (c.lat == null ? (c.locating ? ' locating' : ' unmapped') : '') + (c.id === selected ? ' is-selected' : '');
    li.dataset.cat = c.category; li.dataset.id = c.id; li.tabIndex = 0;
    li.style.setProperty('--life', life(c).toFixed(3));
    const cat = document.createElement('span'); cat.className = 'call-cat'; cat.textContent = LABEL[c.category];
    const type = document.createElement('strong'); type.className = 'call-type'; type.textContent = c.type;
    const addr = document.createElement('span'); addr.className = 'call-addr'; addr.textContent = c.address;
    const meta = document.createElement('span'); meta.className = 'call-meta';
    const age = document.createElement('span'); age.className = 'call-age'; age.textContent = ago(c.first_seen);
    meta.append(`${c.agency_name}, ${fmt(c.received_at || c.first_seen)}, `, age);
    li.append(cat, type, addr, meta);
    li.addEventListener('click', () => select(c.id, true));
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(c.id, true); } });
    return li;
  }
  function emptyItem() {
    const li = document.createElement('li'); li.className = 'empty';
    li.textContent = shown.size < 4 ? 'No active calls match these filters.' : 'No active calls right now. This list refreshes automatically.';
    return li;
  }

  function select(id, fly) {
    selected = id;
    const m = markers.get(id);
    if (m && fly) { map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 15), { duration: 0.6 }); m.openPopup(); }
    if (window.matchMedia('(max-width: 800px)').matches && fly) document.getElementById('map').scrollIntoView({ behavior: 'smooth' });
    listEl.querySelectorAll('.call').forEach((li) => li.classList.toggle('is-selected', li.dataset.id === id));
    const u = new URL(location.href); u.searchParams.set('call', id); history.replaceState(null, '', u);
  }

  async function load() {
    try {
      const r = await fetch('/api/calls', { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      offset = d.serverTime - Date.now();
      calls = d.calls;
      nextAt = (d.nextPollAt ? d.nextPollAt - offset : Date.now() + POLL_MS) + 40_000; // give the background poller time to finish
      updatedEl.textContent = `Updated ${fmt(d.lastPollAt || d.serverTime)}`;
      draw();
      if (firstLoad && selected) { firstLoad = false; if (markers.has(selected)) select(selected, true); }
      firstLoad = false;
    } catch {
      updatedEl.textContent = 'Can’t reach the server. Retrying in 1 minute.';
      nextAt = Date.now() + 60_000;
    }
  }

  document.querySelectorAll('.chip').forEach((btn) => btn.addEventListener('click', () => {
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on));
    on ? shown.add(btn.dataset.cat) : shown.delete(btn.dataset.cat);
    draw();
  }));

  setInterval(() => {
    const left = Math.max(0, nextAt - Date.now());
    nextEl.textContent = left > 0 ? `Next update in ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}` : 'Updating…';
    if (left === 0) { nextAt = Date.now() + 30_000; load(); }
  }, 1000);
  setInterval(draw, 30_000); // age out pins and shrink burn-down bars between updates
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() > nextAt - 5000) load(); });

  load();
})();
