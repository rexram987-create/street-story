const CACHE_NAME = 'street-story-v22';
const APP_SHELL = ['./', './index.html', './styles.css?v=22', './app.js?v=22', './fixes.js?v=22', './source-validation.js?v=22', './jerusalem-source.js?v=22', './wikipedia-street-types.js?v=22', './wikipedia-deep-history.js?v=22', './wikipedia-mention-search.js?v=22', './verified-overrides.js?v=22', './manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html'))));
});
