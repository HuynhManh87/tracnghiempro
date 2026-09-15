const CACHE_NAME = 'omr-mobile-v4.25-shell-v1';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/omr-engine-v4.js?v=4.25-state-machine-scan-once'
];

async function precacheAppShell(){
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(APP_SHELL.map(async url => {
    try {
      const response = await fetch(url, { cache:'reload' });
      if (response.ok) await cache.put(url, response.clone());
      if (url === '/') {
        const html = await response.text();
        const assets = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(m => m[1]);
        await Promise.all([...new Set(assets)].map(async asset => {
          try {
            const res = await fetch(asset, { cache:'reload' });
            if (res.ok) await cache.put(asset, res.clone());
          } catch (_) {}
        }));
      }
    } catch (_) {}
  }));
}

self.addEventListener('install', event => {
  event.waitUntil(precacheAppShell());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/sw.js') {
    event.respondWith(fetch(req, { cache:'no-store' }));
    return;
  }

  // Grading engine: network first; cached copy is only an offline fallback.
  if (url.pathname === '/omr-engine-v4.js') {
    event.respondWith((async()=>{
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(req, { cache:'no-store' });
        if (response.ok) await cache.put(req, response.clone());
        return response;
      } catch (_) {
        return (await cache.match(req)) || Response.error();
      }
    })());
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith((async()=>{
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(req);
        if (response.ok) await cache.put('/', response.clone());
        return response;
      } catch (_) {
        return (await cache.match('/')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
