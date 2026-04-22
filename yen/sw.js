```javascript
const CACHE_NAME = 'necomaid-calc-v3';

// 💡 Cache เฉพาะไฟล์ที่จำเป็นสำหรับแอปนี้เท่านั้น
const urlsToCache = [
  './',               // หน้า index
  './index.html',     // โค้ดหลัก
  './Wave.png',       // รูปน้องเมด
  './unticked.png',   // รูปช่องว่าง
  './ticked.png',     // รูปเครื่องหมายถูก
  './icon-192.png',   // ไอคอน 
  './manifest.json',  // การตั้งค่าแอป
  // พวก Tailwind กับ Font จำเป็นต้องโหลดจากเน็ตมาเก็บไว้ ไม่งั้นหน้าตาตอนออฟไลน์จะไม่สวย
  'https://cdn.tailwindcss.com', 
  'https://fonts.googleapis.com/css2?family=Sarabun:wght@100;300;400;700;800&display=swap'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('NecoMaid: อบข้อมูลลงสมองเฉพาะส่วนเครื่องคิดเลขเรียบร้อย! 🧠✨');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('NecoMaid: จำข้อมูลพลาดเจ้าค่ะ:', err))
  );
});

self.addEventListener('fetch', event => {
  // ดึงเรทเงิน ต้องใช้เน็ตเสมอ ห้ามใช้ Cache เด็ดขาด
  if (event.request.url.includes('open.er-api.com')) {
      event.respondWith(
          fetch(event.request).catch(() => {
              console.log("NecoMaid: ไม่มีเน็ต ข้ามการดึงเรทเงินค่ะ 📡❌");
              return new Response(JSON.stringify({rates: {THB: 0}}), {
                  headers: { 'Content-Type': 'application/json' }
              }); 
          })
      );
      return;
  }

  // สำหรับไฟล์อื่นๆ ในระบบ
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // ถ้ามีใน Cache (หน้าเว็บ, รูป) ให้เอาจากที่เก็บไว้มาใช้เลย
        if (response) {
            return response; 
        }
        
        // ถ้าไม่มี ลองไปโหลดจากเน็ตมา
        return fetch(event.request).then(networkResponse => {
            // โหลดเสร็จ ก็แอบเอามาใส่ Cache ไว้ใช้รอบหน้า
            if(event.request.url.startsWith('http')) {
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            }
            return networkResponse;
        }).catch(() => {
            // ถ้าเน็ตหลุด และหาไม่เจอใน Cache จริงๆ
            console.error("NecoMaid: หาไฟล์นี้ไม่เจอตอนออฟไลน์เจ้าค่ะ ->", event.request.url);
        });
      })
  );
});

self.addEventListener('activate', event => {
  // ลบ Cache ของเวอร์ชันเก่าทิ้ง จะได้ไม่รกเครื่อง
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
});


```
