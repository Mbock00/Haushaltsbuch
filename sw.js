const CACHE_NAME = 'haushaltsbuch-cache-v3';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/supabase.js',
  './js/auth.js',
  './js/buchungen.js',
  './js/dashboard.js',
  './js/auswertungen.js',
  './js/dauerauftraege.js',
  './js/sparziele.js',
  './js/app.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  if (url.includes('supabase.co')) return;
  if (url.includes('vision.googleapis.com')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();

        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, copy))
          .catch(() => {});

        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
