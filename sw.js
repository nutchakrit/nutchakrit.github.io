const CACHE_NAME = 'nck-portal-v5'; // อัปเกรดเป็น v5 เพื่อล้างบั๊กเก่า

// 📝 รายชื่อไฟล์ที่ต้องเก็บไว้ใช้ตอนออฟไลน์ (เน้นไฟล์ที่จำเป็นจริงๆ)
const urlsToCache = [
  './',
  './index.html',
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

// ขั้นตอนติดตั้ง: เก็บไฟล์ลง Cache
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        urlsToCache.map(url =>
          fetch(url).then(response => {
            if (!response.ok) throw new Error(`Network response was not ok for ${url}`);
            // ถ้ามีการ Redirect ให้สร้าง Response ใหม่ที่สะอาด (Clean) เพื่อบันทึก
            if (response.redirected) {
              return fetch(response.url).then(cleanResponse => cache.put(url, cleanResponse));
            }
            return cache.put(url, response);
          }).catch(err => console.warn(`SW: Load failed -> ${url}`, err))
        )
      );
    })
  );
});

// ขั้นตอนเปิดใช้งาน: ลบแคชเก่า
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// การดึงข้อมูล: เน้นดึงจาก Cache ก่อนเพื่อความเร็วและ Offline
self.addEventListener('fetch', event => {
  // ข้ามการตรวจจับถ้าไม่ใช่คำขอประเภท GET (เช่น การส่งข้อมูล)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // 1. ถ้าเจอใน Cache ให้ส่งคืนทันที
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. ถ้าไม่เจอ ให้ไปดึงจากเน็ต
      return fetch(event.request).then(networkResponse => {
        // ตรวจสอบว่าผลลัพธ์ใช้ได้ไหม
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        // แก้ปัญหา Redirect Error ใน Safari: 
        // ถ้าผลลัพธ์มีการ Redirect เราต้องสร้าง Response ใหม่ที่ไม่มีสถานะ Redirect ก่อนส่งคืน
        if (networkResponse.redirected) {
          return fetch(networkResponse.url);
        }

        return networkResponse;
      }).catch(() => {
        // กรณีออฟไลน์และไม่มีในแคช
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Offline Mode - ข้อมูลนี้ยังไม่ได้ถูกบันทึกไว้เจ้าค่ะ', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});