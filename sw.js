importScripts('./config.js');

const urlsToCache = [
  './',
  './index.html',
  './config.js',
  './manifest.json',
  './MainCloud.png',
  './MainBanner.png',
  './MainSplash.png',
  './Cloud1.png',
  './Cloud2.png',
  './ComingSoon-Cloud.png',
  './Darkmode-cloud.png',
  './On-Hover.png',
  './OnClick.mp3',
  './Normal-Mouse-Click.mp3',
  './hatachi-no-koi.mp3',
  './Aoi-Sangosho.mp3',
  './BookEndBossa.mp3',
  './suki-no-oto.mp3',
  './anata-no-koibito.mp3',
  './Wallpaper-Light.webp',
  './Wallpaper-Dark.webp'
];

function broadcastProgress(loaded, total, done) {
  self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'SW_CACHE_PROGRESS', loaded, total, done: !!done });
    });
  });
}

self.addEventListener('install', event => {
  self.skipWaiting();
  const total = urlsToCache.length;
  let loaded = 0;

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return urlsToCache.reduce((chain, url) => {
        return chain.then(() =>
          fetch(url)
            .then(response => {
              if (!response.ok) throw new Error('Failed: ' + url);
              if (response.redirected) {
                return fetch(response.url).then(clean => cache.put(url, clean));
              }
              return cache.put(url, response);
            })
            .catch(err => console.warn('SW: Load failed ->', url, err))
            .finally(() => {
              loaded++;
              broadcastProgress(loaded, total, loaded === total);
            })
        );
      }, Promise.resolve());
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.map(n => n !== CACHE_NAME && caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (!res || res.status !== 200) return res;
        if (res.redirected) return fetch(res.url);
        return res;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline Mode - ข้อมูลนี้ยังไม่ได้ถูกบันทึกไว้เจ้าค่ะ', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});