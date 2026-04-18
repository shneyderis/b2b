const CACHE = 'winery-b2b-v1';
const PRECACHE = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

const OFFLINE_HTML = `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Winery B2B</title>
<style>
  html,body{height:100%;margin:0;font-family:system-ui,sans-serif;background:#fafaf9;color:#111}
  .box{min-height:100%;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}
  h1{color:#6e172e;font-size:22px;margin:0 0 8px}
  p{color:#555;margin:0}
</style></head>
<body><div class="box"><div><h1>Немає зʼєднання</h1><p>Перевірте інтернет і спробуйте ще раз.</p></div></div></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() =>
          caches.match(req)
            .then((hit) => hit || caches.match('/index.html'))
            .then((hit) => hit || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).catch(() => new Response('', { status: 504 })))
  );
});
