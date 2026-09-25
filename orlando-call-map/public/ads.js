// Loads one AdSense unit in the side panel, unless ads aren't configured or this browser belongs to a supporter.
(async () => {
  const slot = document.getElementById('ad-slot');
  if (!slot || !slot.dataset.client || !slot.dataset.slot) return;
  try {
    const r = await fetch('/api/ad-free', { credentials: 'same-origin', cache: 'no-store' });
    if (r.ok && (await r.json()).adFree) return; // supporter: no ad script is loaded at all
  } catch { /* if the check fails, fall through and show the ad */ }

  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.style.display = 'block';
  ins.dataset.adClient = slot.dataset.client;
  ins.dataset.adSlot = slot.dataset.slot;
  ins.dataset.adFormat = 'auto';
  ins.dataset.fullWidthResponsive = 'true';
  document.getElementById('ad-box').append(ins);
  slot.hidden = false;

  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(slot.dataset.client)}`;
  s.onerror = () => { slot.hidden = true; }; // ad blocked or failed: remove the empty box
  document.head.append(s);
  (window.adsbygoogle = window.adsbygoogle || []).push({});
})();
