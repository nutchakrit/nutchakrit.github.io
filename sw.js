importScripts('./config.js');

// แนะนำให้แก้ CACHE_NAME ใน config.js เป็นเวอร์ชันใหม่ (เช่น v1.2.6) เพื่อบังคับให้ SW อัปเดตใหม่หมด
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

self.addEventListener('install', event => {
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // โหลดแยกทีละไฟล์ เพื่อไม่ให้เกิดการชนกันของ Network Requests
      return Promise.all(
        urlsToCache.map(url => {
          return fetch(url)
            .then(response => {
              if (!response.ok) throw new Error('Failed: ' + url);
              if (response.redirected) {
                return fetch(response.url).then(clean => cache.put(url, clean));
              }
              return cache.put(url, response);
            })
            .catch(err => console.warn('SW: Cache failed for ->', url, err));
        })
      );
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
        // กรณีเป็น partial content 206 บางทีจะไม่เข้าเงื่อนไขนี้ แต่ก็ปล่อยให้ browser จัดการปกติ
        return res;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline Mode - ขออภัย ข้อมูลนี้ยังไม่ได้ถูกบันทึกไว้ในเครื่องเจ้าค่ะ', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});