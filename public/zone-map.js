// Shared mini map for previewing alert areas.
window.ZoneMap = (el) => {
  const map = L.map(el).setView([28.51, -81.36], 10);
  fetch('/api/config').then((r) => r.json()).then((c) => L.tileLayer(c.tileUrl, { maxZoom: 19, attribution: c.tileAttribution }).addTo(map));
  const layers = L.layerGroup().addTo(map);
  return {
    map,
    draw(zones) {
      layers.clearLayers();
      const pts = [];
      for (const z of zones) {
        if (z.lat == null) continue;
        const c = L.circle([z.lat, z.lng], { radius: z.radius * 1609.34, color: '#F28C28', weight: 2, fillOpacity: 0.12 }).addTo(layers);
        L.circleMarker([z.lat, z.lng], { radius: 5, color: '#0F2C3F', fillColor: '#F28C28', fillOpacity: 1 }).addTo(layers);
        pts.push(c.getBounds());
      }
      if (pts.length) map.fitBounds(pts.reduce((a, b) => a.extend(b)), { padding: [20, 20], maxZoom: 15 });
    },
  };
};
window.geocodeAddress = async (address) => {
  const r = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'We couldn’t find that address.');
  return d;
};
