const CACHE_NAME = 'nck-portal-v4'; // อัปเกรดเวอร์ชันเป็น v4 เพื่อเคลียร์แคชเก่าที่มีบั๊กออกไป

// 📝 รายชื่อไฟล์ทั้งหมดที่ต้องเก็บไว้ใช้ตอนออฟไลน์
const urlsToCache = [
  './',
  './index.html',
  './MainCloud.png',
  './MainBanner.png',
  './MainSplash.png',
  './Cloud1.png',
  './Cloud2.png',
  './ComingSoon-Cloud.png',
  './Darkmode-cloud.png',
  './On-Hover.png',
  './manifest.json',
  './OnClick.mp3',
  './Normal-Mouse-Click.mp3',
  './hatachi-no-koi.mp3',
  './Aoi-Sangosho.mp3',
  './BookEndBossa.mp3',
  './suki-no-oto.mp3',
  './anata-no-koibito.mp3',
  './Wallpaper-Light.webp',
  './Wallpaper-Dark.webp',
  // เพิ่มเส้นทางของแอป Yen ลงไปเพื่อให้กดเข้าตอนไม่มีเน็ตได้
  '/yen',
  '/YenCalculate-v5.html' 
];

// ขั้นตอนการติดตั้ง: เก็บไฟล์ลง Cache
self.addEventListener('install', event => {
  self.skipWaiting(); // บังคับให้ Service Worker ตัวใหม่ทำงานทันทีที่โหลดเสร็จ
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // ใช้ Promise.allSettled แบบเดียวกับแอป Yen จะได้ไม่ล่มทั้งหมดถ้ามีไฟล์ไหนหาไม่เจอ
        return Promise.allSettled(
          urlsToCache.map(url =>
            cache.add(url).catch(err => {
              console.warn(`Service Worker: โหลดไฟล์นี้ลง Cache ไม่สำเร็จ -> ${url}`, err);
            })
          )
        );
      })
  );
});

// ขั้นตอนการเปิดใช้งาน: ลบ Cache เก่าทิ้งถ้ามีการเปลี่ยนชื่อ CACHE_NAME
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: กำลังลบ Cache เก่า...', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// การดึงข้อมูล: ดึงจาก Cache ก่อน ถ้าไม่มีค่อยโหลดจากเน็ต
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        let fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            let responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                if (event.request.url.startsWith(self.location.origin)) {
                    cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        ).catch(() => {
             // ✅ กรณีออฟไลน์และไม่มีใน cache ต้องคืนค่า Response กลับไปเสมอ ป้องกันบั๊กหน้าขาว (Null Response)
             return new Response('Offline - ตอนนี้ไม่มีอินเทอร์เน็ตนะเจ้าคะ 💦', { 
                 status: 503, 
                 statusText: 'Service Unavailable',
                 headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
             });
        });
      })
  );
});