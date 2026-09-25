(() => {
  const $ = (id) => document.getElementById(id);
  const zm = ZoneMap($('mini-map'));
  let spot = null;
  const msg = (t, ok) => { $('msg').textContent = t; $('msg').className = 'msg ' + (ok ? 'ok' : 'err'); };
  const redraw = () => zm.draw(spot ? [{ ...spot, radius: +$('radius').value }] : []);

  $('radius').addEventListener('input', () => { $('rout').textContent = $('radius').value; redraw(); });
  $('address').addEventListener('input', () => { spot = null; });

  async function find() {
    const a = $('address').value.trim();
    if (!a) return msg('Enter an address to watch.');
    msg('Finding that address…', true);
    try { spot = await geocodeAddress(a); redraw(); msg('Found it. Adjust the radius to cover the area you care about.', true); return true; }
    catch (e) { spot = null; msg(e.message); return false; }
  }
  $('find').addEventListener('click', find);

  $('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!spot && !(await find())) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($('email').value.trim())) return msg('Enter a valid email address.');
    const cats = [...document.querySelectorAll('input[name=cat]:checked')].map((c) => c.value);
    if (!cats.length) return msg('Choose at least one type of call.');
    if (!$('agree').checked) return msg('Check the box to confirm you understand how alerts work.');
    $('go').disabled = true; msg('Opening secure checkout…', true);
    try {
      const r = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        email: $('email').value.trim(), phone: $('phone').value.trim(), categories: cats,
        zone: { address: $('address').value.trim(), label: $('label').value.trim() || 'Home', radius: +$('radius').value },
      }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      location.href = d.url;
    } catch (err) { msg(err.message || 'Checkout didn’t open. Try again.'); $('go').disabled = false; }
  });
})();
