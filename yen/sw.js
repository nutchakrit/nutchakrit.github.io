/**
 * NecoYen Service Worker v6
 * ออกแบบมาเพื่อรองรับการใช้งาน Offline ในญี่ปุ่น 🇯🇵
 */

const CACHE_NAME = 'necomaid-calc-v1.2';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './unticked.png',
  './ticked.png',
  './icon-192.png',
  './hatachi-no-koi.mp3',
  './Aoi-Sangosho.mp3',
  './BookEndBossa.mp3',
  './suki-no-oto.mp3',
  './anata-no-koibito.mp3',
  './OnClick.mp3',
  './Normal-Mouse-Click.mp3'
];
// หมายเหตุ: ตัด CDN URL ออกแล้ว เพราะ cache cross-origin ไม่ reliable

const RATE_CACHE_KEY = 'necomaid-cached-rate';

// ส่ง progress กลับไปหาหน้าเว็บ
function broadcastProgress(loaded, total, done) {
  self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'SW_CACHE_PROGRESS', loaded, total, done: !!done });
    });
  });
}

// ติดตั้ง: เก็บไฟล์ทีละตัวพร้อมส่ง progress
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
            .catch(err => console.warn('SW: ข้ามการ Cache ->', url))
            .finally(() => {
              loaded++;
              broadcastProgress(loaded, total, loaded === total);
            })
        );
      }, Promise.resolve());
    })
  );
});

// เปิดใช้งาน: ลบ cache เก่า
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: จัดการ API เรทเงินพิเศษ + Cache First ทั่วไป
self.addEventListener('fetch', event => {
  if (event.request.url.includes('open.er-api.com')) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        const clone = networkResponse.clone();
        clone.json().then(data => {
          if (data?.rates?.THB) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(RATE_CACHE_KEY, new Response(JSON.stringify(data), {
                headers: { 'Content-Type': 'application/json' }
              }));
            });
          }
        }).catch(() => {});
        return networkResponse;
      }).catch(() => caches.match(RATE_CACHE_KEY))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (!res || res.status !== 200) return res;
        if (res.redirected) return fetch(res.url);
        return res;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline Mode', { status: 503 });
      });
    })
  );
});