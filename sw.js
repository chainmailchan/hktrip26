// Offline-first service worker.
// - SHELL: app code and data. Served from cache; each time the app opens it is
//   re-checked with conditional requests (304 = nothing downloaded). Changes are
//   stored together and the page reloads on its next open ("update on next open").
// - KEEP: fonts, icons and every image in art/art-manifest.json. Downloaded once,
//   never again. A changed image needs a new file name.

const SHELL = 'shell';
const KEEP = 'keep';

const SHELL_FILES = [
  './',
  'manifest.webmanifest',
  'app/app.css',
  'app/app.js',
  'app/art.js',
  'art/art-manifest.json',
  'data/art-schedule.json',
  'data/emergency.json',
  'data/greetings.json',
  'data/itinerary.json',
  'data/packing.json',
  'data/people.json',
  'data/trip.json'
];

const KEEP_FILES = [
  'fonts/figtree-latin-wght.woff2',
  'fonts/barlow-condensed-latin-500.woff2',
  'fonts/barlow-condensed-latin-700.woff2',
  'fonts/noto-sans-hk-700.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

const scopePath = new URL('./', self.location).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    await shell.addAll(SHELL_FILES.map((p) => new Request(p, { cache: 'no-cache' })));
    await fillKeep();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name !== SHELL && name !== KEEP) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'refresh') event.waitUntil(refresh());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isApp = req.mode === 'navigate' && (url.pathname === scopePath || url.pathname === scopePath + 'index.html');
  if (isApp) {
    event.respondWith(caches.open(SHELL).then((c) => c.match('./')).then((r) => r || fetch(req)));
    event.waitUntil(refresh());
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});

// Download fonts, icons and art that are not cached yet. Never re-downloads.
async function fillKeep() {
  const keep = await caches.open(KEEP);
  const shell = await caches.open(SHELL);
  const manifest = await (await shell.match('art/art-manifest.json')).json();
  const wanted = KEEP_FILES.concat(manifest.images.map((i) => i.file));
  const missing = [];
  for (const path of wanted) {
    if (!(await keep.match(path))) missing.push(path);
  }
  await keep.addAll(missing);
}

// Re-check every shell file with If-None-Match / If-Modified-Since. If any came
// back changed, store the whole set at once and tell the page.
let lastRefresh = 0;
async function refresh() {
  if (Date.now() - lastRefresh < 60 * 1000) return;
  lastRefresh = Date.now();
  try {
    const shell = await caches.open(SHELL);
    const results = await Promise.all(SHELL_FILES.map(async (path) => {
      const old = await shell.match(path);
      const headers = {};
      if (old && old.headers.get('ETag')) headers['If-None-Match'] = old.headers.get('ETag');
      if (old && old.headers.get('Last-Modified')) headers['If-Modified-Since'] = old.headers.get('Last-Modified');
      const res = await fetch(path, { headers, cache: 'no-store' });
      if (res.status === 304) return null;
      if (!res.ok) throw new Error(path + ' ' + res.status);
      const changed = !old || (await old.clone().text()) !== (await res.clone().text());
      return { path, res, changed };
    }));
    const fresh = results.filter(Boolean);
    if (!fresh.length) return;
    await Promise.all(fresh.map((f) => shell.put(f.path, f.res)));
    await fillKeep();
    if (fresh.some((f) => f.changed)) {
      for (const client of await self.clients.matchAll({ type: 'window' })) client.postMessage('updated');
    }
  } catch (e) {
    // Offline or a failed download: keep what we have and try on the next open.
    lastRefresh = 0;
  }
}
