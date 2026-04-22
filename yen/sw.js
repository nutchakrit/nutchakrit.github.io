const CACHE_NAME = 'necomaid-calc-v4';

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

// 🔑 Key สำหรับเก็บเรทสำรองไว้ใน Cache Storage (ใช้แทน localStorage ใน SW)
const RATE_CACHE_KEY = 'necomaid-cached-rate';

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('NecoMaid: อบข้อมูลลงสมองเฉพาะส่วนเครื่องคิดเลขเรียบร้อย! 🧠✨');
      // ✅ แก้: ใช้ allSettled แทน addAll
      // addAll() จะ fail ทั้งหมดถ้าไฟล์เดียวโหลดไม่ได้
      // allSettled() จะ cache ได้เท่าที่โหลดสำเร็จ ไม่ทิ้งทุกอย่าง
      return Promise.allSettled(
        urlsToCache.map(url =>
          cache.add(url).catch(err => {
            console.warn(`NecoMaid: cache ไฟล์นี้ไม่ได้ แต่ไม่เป็นไรเจ้าค่ะ -> ${url}`, err);
          })
        )
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // ดึงเรทเงิน — ต้องพยายามใช้เน็ตก่อนเสมอ
  if (event.request.url.includes('open.er-api.com')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // ✅ แก้: ตอนออนไลน์ แอบบันทึกเรทล่าสุดเอาไว้ใน Cache เผื่อไว้ใช้ตอนออฟไลน์
          networkResponse.clone().json().then(data => {
            if (data?.rates?.THB > 0) {
              caches.open(CACHE_NAME).then(cache => {
                const rateResponse = new Response(JSON.stringify({ rates: { THB: data.rates.THB } }), {
                  headers: { 'Content-Type': 'application/json' }
                });
                cache.put(RATE_CACHE_KEY, rateResponse);
                console.log(`NecoMaid: บันทึกเรทสำรองไว้แล้ว (${data.rates.THB}) 💾`);
              });
            }
          }).catch(() => {});
          return networkResponse;
        })
        .catch(() => {
          console.log("NecoMaid: ไม่มีเน็ต ลองหาเรทสำรองใน Cache ก่อนนะเจ้าค่ะ 📡");
          // ✅ แก้: แทนที่จะคืน THB: 0 ให้ดึงเรทที่บันทึกไว้ครั้งล่าสุดมาใช้แทน
          return caches.open(CACHE_NAME).then(cache =>
            cache.match(RATE_CACHE_KEY).then(cached => {
              if (cached) {
                console.log("NecoMaid: เจอเรทสำรอง ใช้อันเก่าแทนได้เลยเจ้าค่ะ ✅");
                return cached;
              }
              // ถ้าไม่มีเรทสำรองเลย (ยังไม่เคยออนไลน์มาก่อน) ค่อยคืน 0
              console.warn("NecoMaid: ไม่มีเรทสำรอง ยังไม่เคยออนไลน์มาก่อนเลยเจ้าค่ะ 😢");
              return new Response(JSON.stringify({ rates: { THB: 0 } }), {
                headers: { 'Content-Type': 'application/json' }
              });
            })
          );
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
          if (event.request.url.startsWith('http')) {
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
