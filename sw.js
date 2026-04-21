const CACHE_NAME = 'nck-portal-v2'; // อัปเกรดเวอร์ชันเมื่อมีการเปลี่ยนไฟล์

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
  // --- ไฟล์ที่เพิ่มใหม่ ---
  './OnClick.mp3',
  './hatachi-no-koi.mp3',
  './Aoi-Sangosho.mp3',
  './BookEndBossa.mp3',
  './Wallpaper-Light.webp',
  './Wallpaper-Dark.webp'
];

// ขั้นตอนการติดตั้ง: เก็บไฟล์ลง Cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
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
                // เก็บเฉพาะไฟล์ที่เป็น origin เดียวกัน (ไม่เก็บพวก Google Fonts เพราะอาจติด CORS)
                if (event.request.url.startsWith(self.location.origin)) {
                    cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        ).catch(() => {
             // กรณีออฟไลน์และไม่มีใน cache
        });
      })
  );
});