importScripts('./config.js');

// แนะนำให้แก้ CACHE_NAME ใน config.js เป็นเวอร์ชันใหม่ (เช่น v1.2.6) เพื่อบังคับให้ SW อัปเดตใหม่หมด
const urlsToCache = [
  './',
  './index.html',
  './config.js',
  './manifest.json',
  './music-timestamps.json',
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
  './suki-cho-ver.mp3',
  './Popping-Shower.mp3',
  './Im-so-happy.mp3',
  './Sakura-Storm.mp3',
  './Xepher.mp3',
  './Sakura-Sunrise.mp3',
  './Daisycutter.mp3',
  './Wallpaper-Light.webp',
  './Wallpaper-Dark.webp',
  // ===== Vendor assets (self-hosted แทน CDN) =====
  './vendor/tailwind/tailwind.min.css',
  './vendor/fonts/mali/mali.css',
  './vendor/fonts/mali/mali-thai-400-normal.woff2',
  './vendor/fonts/mali/mali-thai-500-normal.woff2',
  './vendor/fonts/mali/mali-thai-600-normal.woff2',
  './vendor/fonts/mali/mali-thai-700-normal.woff2',
  './vendor/fonts/mali/mali-latin-400-normal.woff2',
  './vendor/fonts/mali/mali-latin-500-normal.woff2',
  './vendor/fonts/mali/mali-latin-600-normal.woff2',
  './vendor/fonts/mali/mali-latin-700-normal.woff2',
  './vendor/fonts/mali/mali-latin-ext-400-normal.woff2',
  './vendor/fonts/mali/mali-latin-ext-500-normal.woff2',
  './vendor/fonts/mali/mali-latin-ext-600-normal.woff2',
  './vendor/fonts/mali/mali-latin-ext-700-normal.woff2'
];

// พยายาม fetch+cache ไฟล์เดียว โดย retry ซ้ำถ้าพลาด (กันเน็ตกระตุกตอน install ครั้งแรก
// ซึ่งเป็นสาเหตุที่บางเพลง cache ไม่ติดแบบสุ่มๆ)
async function cacheUrlWithRetry(cache, url, retriesLeft = 2) {
  try {
    const response = await fetch(url, { cache: 'reload' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    if (response.redirected) {
      const clean = await fetch(response.url, { cache: 'reload' });
      await cache.put(url, clean);
    } else {
      await cache.put(url, response);
    }
    return true;
  } catch (err) {
    if (retriesLeft > 0) {
      return cacheUrlWithRetry(cache, url, retriesLeft - 1);
    }
    console.warn('SW: Cache failed for ->', url, err);
    return false;
  }
}

self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // โหลดแยกทีละไฟล์ (พร้อม retry ในตัว) เพื่อไม่ให้เกิดการชนกันของ Network Requests
      const results = await Promise.all(
        urlsToCache.map(url => cacheUrlWithRetry(cache, url))
      );
      const failedUrls = urlsToCache.filter((url, i) => !results[i]);
      if (failedUrls.length > 0) {
        console.warn('SW: ไฟล์ต่อไปนี้ cache ไม่สำเร็จหลัง retry แล้ว (จะใช้ offline ไม่ได้จนกว่าจะ install ใหม่ตอนมีเน็ต):', failedUrls);
      } else {
        console.log('SW: cache ไฟล์สำเร็จครบทั้งหมด', urlsToCache.length, 'ไฟล์');
      }
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