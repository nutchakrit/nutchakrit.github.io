/**
 * NecoYen Service Worker v6
 * ออกแบบมาเพื่อรองรับการใช้งาน Offline ในญี่ปุ่น 🇯🇵
 */

const CACHE_NAME = 'necomaid-calc-v6';

// 📝 รายชื่อไฟล์ที่ต้องเก็บไว้ใช้ตอนออฟไลน์
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './unticked.png',
  './ticked.png',
  './icon-192.png',
  // รายชื่อไฟล์เพลงจาก music-timestamps.json
  './hatachi-no-koi.mp3',
  './Aoi-Sangosho.mp3',
  './BookEndBossa.mp3',
  './suki-no-oto.mp3',
  './anata-no-koibito.mp3',
  './OnClick.mp3',
  './Normal-Mouse-Click.mp3',
  // ไฟล์ภายนอกที่จำเป็นสำหรับการแสดงผล
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Sarabun:wght@100;300;400;700;800&display=swap'
];

// 🔑 Key สำหรับเก็บเรทเงินสำรองใน Cache Storage
const RATE_CACHE_KEY = 'necomaid-cached-rate';

// ขั้นตอนติดตั้ง: เก็บไฟล์ลงสมอง (Cache)
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('SW: กำลังเตรียมระบบ Offline สำหรับ Version 1.1.2...');
      return Promise.allSettled(
        urlsToCache.map(url =>
          fetch(url).then(response => {
            if (!response.ok) throw new Error(`Load failed: ${url}`);
            
            // ✅ แก้ไขบั๊ก Safari: ถ้ามีการ Redirect ให้ Fetch ใหม่เอาค่าที่สะอาดมาเก็บ
            if (response.redirected) {
              return fetch(response.url).then(cleanRes => cache.put(url, cleanRes));
            }
            return cache.put(url, response);
          }).catch(err => console.warn(`SW: ข้ามการ Cache -> ${url}`))
        )
      );
    })
  );
});

// ขั้นตอนเปิดใช้งาน: เคลียร์ความจำเก่า (ลบ Cache v4/v5 ทิ้ง)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
});

// การดึงข้อมูล: เน้นความเร็ว (Cache First) และรองรับออฟไลน์
self.addEventListener('fetch', event => {
  // พิเศษ: จัดการคำขอเรทเงินจาก API
  if (event.request.url.includes('open.er-api.com')) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        // เมื่อออนไลน์: บันทึกเรทใหม่ล่าสุดเก็บไว้เสมอ
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
      }).catch(() => {
        // เมื่อออฟไลน์: ดึงเรทเก่าจาก Cache มาใช้แทน
        return caches.match(RATE_CACHE_KEY);
      })
    );
    return;
  }

  // สำหรับไฟล์ทั่วไป (HTML, CSS, MP3, Images)
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // 1. ถ้ามีใน Cache ให้ดึงมาใช้เลย (เร็วที่สุด)
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. ถ้าไม่มีใน Cache ให้โหลดจากเน็ต
      return fetch(event.request).then(networkResponse => {
        // ตรวจสอบความถูกต้องและจัดการเรื่อง Redirect อีกครั้ง
        if (!networkResponse || networkResponse.status !== 200) return networkResponse;
        
        if (networkResponse.redirected) {
          return fetch(networkResponse.url);
        }
        
        return networkResponse;
      }).catch(() => {
        // กรณีออฟไลน์สุดๆ และหาไฟล์ไม่เจอ
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Offline Mode', { status: 503 });
      });
    })
  );
});