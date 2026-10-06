/* Service worker: keeps the app working offline.
   Own files: network first (so updates arrive), cache as fallback.
   Libraries and fonts from a short list of hosts: cache first. Everything else is not touched. */
const VERSION = 'gni-phase3-31-v1';  // Added a Stock/Sector toggle to the View Chart modal: alongside the
                                      // single company's chart, Automotive/Banking/Metals & Mining/Pharma/
                                      // Technology/Energy/Consumer/Infrastructure/Semiconductors/Aerospace/
                                      // Defence stories can now also show the real NSE Nifty sectoral index
                                      // (for Indian companies) or a global sector-ETF proxy (for everyone
                                      // else) right next to the stock, one tap away. The toggle only appears
                                      // when a sector actually has a sensible benchmark - sectors like
                                      // Geopolitics/Economy/Climate have none, so no toggle shows rather than
                                      // guessing a bad symbol. Bumped for the same reason as every prior
                                      // bump - the service worker caches index.html/app.js itself, so
                                      // without a new VERSION an already-installed visitor can keep seeing
                                      // the old page.
const SHELL = ['./', 'index.html', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* Real OS-level push notifications ("Waveform Arrival"), separate from the in-app toast in app.js (that one
   only shows while a tab is open). The pipeline (pipeline.py's send_push_notifications()) posts a Web Push
   message carrying one new story's id/flag/country/sector/headline after every publish; this is what actually
   turns that message into a notification the OS shows, even if no tab is open at all. */
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { /* malformed payload: fall through to defaults below */ }
  const title = (data.flag ? data.flag + ' ' : '') + (data.country || 'QwickSignal');
  const body = data.headline || 'A new story just came in.';
  const id = data.id || '';
  e.waitUntil(self.registration.showNotification(title, {
    body,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: id || 'qs-story',       // a second push for the same story replaces the first instead of stacking
    renotify: !!id,
    data: { id, kicker: data.sector ? (data.country || '') + ' · ' + data.sector : (data.country || '') }
  }));
});

// Tapping the notification: focus an already-open tab and hand it the story id to jump to, or open a fresh
// tab at #<id> which app.js reads on load (see the hashchange/DOMContentLoaded handling added there).
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const id = (e.notification.data && e.notification.data.id) || '';
  e.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clientsList) {
      if ('focus' in c) {
        await c.focus();
        if (id) c.postMessage({ type: 'qs-goto', id });
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(id ? './#' + encodeURIComponent(id) : './');
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const LIBS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
  if (!same && !LIBS.includes(url.hostname)) return; // live data (raw.githubusercontent.com) always goes to the network
  const keep = res => {
    if (res && (res.status === 200 || res.type === 'opaque')) {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
    }
    return res;
  };
  if (same) {
    e.respondWith(fetch(req).then(keep).catch(() =>
      caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./'))));
  } else {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(keep)));
  }
});
