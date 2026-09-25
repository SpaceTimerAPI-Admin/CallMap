(() => {
  const $ = (id) => document.getElementById(id);
  const zm = ZoneMap($('mini-map'));
  let spot = null;
  let amount = 10, cfg = { supportMin: 3, supportMax: 500, supportPresets: [5, 10, 20] };

  function renderAmounts() {
    $('min').textContent = cfg.supportMin;
    const row = $('presets'); row.replaceChildren();
    const opts = [...cfg.supportPresets.filter((n) => n >= cfg.supportMin), 'other'];
    if (!cfg.supportPresets.includes(amount)) amount = opts[Math.min(1, opts.length - 2)] ?? cfg.supportMin;
    for (const v of opts) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'amount';
      b.textContent = v === 'other' ? 'Other' : `$${v}/mo`;
      b.setAttribute('aria-pressed', String(v === amount));
      b.onclick = () => {
        row.querySelectorAll('.amount').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        $('other-wrap').hidden = v !== 'other';
        amount = v === 'other' ? 'other' : v;
        if (v === 'other') $('other').focus();
      };
      row.append(b);
    }
  }
  fetch('/api/config').then((r) => r.json()).then((c) => { cfg = { ...cfg, ...c }; renderAmounts(); }).catch(renderAmounts);
  renderAmounts();
  const chosenAmount = () => (amount === 'other' ? Math.round(Number($('other').value)) : amount);
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
    const dollars = chosenAmount();
    if (!Number.isFinite(dollars) || dollars < cfg.supportMin || dollars > cfg.supportMax) return msg(`Choose a monthly amount from $${cfg.supportMin} to $${cfg.supportMax}.`);
    if (!$('agree').checked) return msg('Check the box to confirm you understand how alerts work.');
    $('go').disabled = true; msg('Opening secure checkout…', true);
    try {
      const r = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        email: $('email').value.trim(), phone: $('phone').value.trim(), categories: cats, amount: dollars,
        zone: { address: $('address').value.trim(), label: $('label').value.trim() || 'Home', radius: +$('radius').value },
      }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      location.href = d.url;
    } catch (err) { msg(err.message || 'Checkout didn’t open. Try again.'); $('go').disabled = false; }
  });
})();
