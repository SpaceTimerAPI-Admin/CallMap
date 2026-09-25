(() => {
  const $ = (id) => document.getElementById(id);
  const token = location.pathname.split('/')[2];
  const MAX = 3;

  if (!token) {
    $('lost').hidden = false;
    $('resend').addEventListener('submit', async (e) => {
      e.preventDefault();
      await fetch('/api/resend-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: $('r-email').value.trim() }) });
      $('r-msg').className = 'msg ok';
      $('r-msg').textContent = 'If that email has alerts, a manage link is on its way.';
    });
    return;
  }

  $('app').hidden = false;
  const zm = ZoneMap($('mini-map'));
  let zones = [];
  const msg = (t, ok) => { $('msg').textContent = t; $('msg').className = 'msg ' + (ok ? 'ok' : 'err'); };
  const redraw = () => zm.draw(zones);

  function render() {
    const wrap = $('zones'); wrap.replaceChildren();
    zones.forEach((z, i) => {
      const n = $('zone-tpl').content.firstElementChild.cloneNode(true);
      const q = (s) => n.querySelector(s);
      q('.z-label').value = z.label || '';
      q('.z-address').value = z.address || '';
      q('.z-radius').value = z.radius; q('.z-rout').textContent = z.radius;
      q('.z-label').oninput = (e) => { z.label = e.target.value; };
      q('.z-address').oninput = (e) => { z.address = e.target.value; z.lat = z.lng = null; };
      q('.z-radius').oninput = (e) => { z.radius = +e.target.value; q('.z-rout').textContent = z.radius; redraw(); };
      q('.z-find').onclick = async () => {
        try { Object.assign(z, await geocodeAddress(z.address)); redraw(); msg('Found it.', true); } catch (e) { msg(e.message); }
      };
      q('.z-remove').onclick = () => { if (zones.length === 1) return msg('Keep at least one place, or cancel from Billing.'); zones.splice(i, 1); render(); redraw(); };
      wrap.append(n);
    });
    $('add').hidden = zones.length >= MAX;
  }

  $('add').onclick = () => { zones.push({ label: '', address: '', radius: 1, lat: null, lng: null }); render(); };

  fetch(`/api/manage/${token}`).then(async (r) => {
    const d = await r.json();
    if (!r.ok) { $('app').hidden = true; $('lost').hidden = false; $('r-msg').className = 'msg err'; $('r-msg').textContent = 'That link has expired or is wrong. Request a new one.'; return; }
    const active = d.status === 'active' || d.status === 'trialing';
    $('who').textContent = `${d.email}. ${active ? `Supporting${d.amount ? ` at $${d.amount} a month` : ''}. Alerts are on.` : `Support ${d.status.replace('_', ' ')}. Alerts are paused.`}`;
    zones = d.zones.map((z) => ({ label: z.label, address: z.address, radius: z.radius_mi, lat: z.lat, lng: z.lng }));
    document.querySelectorAll('input[name=cat]').forEach((c) => { c.checked = d.categories.includes(c.value); });
    $('amount').value = d.amount || '';
    $('n-email').checked = !!d.notify_email; $('n-sms').checked = !!d.notify_sms; $('phone').value = d.phone || '';
    render(); redraw();
  });

  $('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (zones.some((z) => z.lat == null)) return msg('Tap Find on each new or changed address first.');
    const r = await fetch(`/api/manage/${token}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      zones, phone: $('phone').value.trim(), notify_email: $('n-email').checked, notify_sms: $('n-sms').checked,
      categories: [...document.querySelectorAll('input[name=cat]:checked')].map((c) => c.value),
    }) });
    const d = await r.json();
    r.ok ? msg('Saved. New alerts will use these settings.', true) : msg(d.error);
  });

  $('set-amount').onclick = async () => {
    const r = await fetch(`/api/manage/${token}/amount`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number($('amount').value) }) });
    const d = await r.json();
    r.ok ? msg(`Updated. Your next bill will be $${d.amount}. Thank you.`, true) : msg(d.error);
  };

  $('billing').onclick = async () => {
    const r = await fetch(`/api/manage/${token}/billing`, { method: 'POST' });
    const d = await r.json();
    r.ok ? (location.href = d.url) : msg(d.error);
  };
})();
