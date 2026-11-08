const CACHE='naprawnik-v5-48-native';
const PRECACHE=[
  './index.html',
  './native-bridge.js',
  './billing.js?v=17',
  './katalog-techniczny.js',
  './druciarstwo.js',
  './motocykle-multi-data.js',
  './motocykle-multi.js',
  './manifest.webmanifest',
  './assets/naprawnik-icon.svg',
  './assets/naprawnik-icon-192.svg',
  './assets/naprawnik-icon-512.svg',
  './assets/workshop-bg.jpg',
  './assets/mod-clients.jpg',
  './assets/mod-orders.jpg',
  './assets/mod-diag.jpg',
  './assets/mod-electric.jpg',
  './assets/mod-tech.jpg',
  './assets/mod-tools.jpg',
  './assets/neon-tiles-art.jpg',
  './assets/tile-hud.jpg',
  './assets/tile-jetting.jpg',
  './assets/tile-cvt.jpg',
  './assets/tile-pinouts.jpg',
  './assets/tile-squish.jpg',
  './assets/tile-orders.jpg',
  './assets/tile-druciarstwo.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks =>
      Promise.all(
        ks.filter(k => k.startsWith('naprawnik-') && k.endsWith('-native') && k !== CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.action === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/.netlify/')) return;

  if (e.request.mode === 'navigate' || u.pathname === '/' || u.pathname.endsWith('/index.html')) {
    e.respondWith(
      caches.match('./index.html').then(cached => cached || fetch(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
