// Service worker: rende l'app installabile e la fa aprire subito, anche con rete debole.
//  - foto dei prodotti: dalla copia sul telefono (non cambiano mai, il nome cambia se cambia la foto)
//  - pagina, stile e programma: si mostra subito la copia salvata e intanto si scarica quella nuova
//  - catalogo e ordini (/api/): sempre dalla rete, ci pensa l'app a tenere l'ultima copia
const CACHE = 'salvaspesa-v2';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;

  if (url.pathname.includes('/img/prodotti/')) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }

  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const rete = fetch(e.request).then((res) => {
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(rete); return hit; }
    return (await rete) || (await c.match('index.html')) || Response.error();
  }));
});
