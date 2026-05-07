/**
 * NecoYen & Pocket Service Worker v7.0
 * อัปเกรดระบบ Caching ให้ฉลาดขึ้น (Network First สำหรับ HTML, Cache First สำหรับไฟล์คงที่)
 */

importScripts('./config.js');

const urlsToCache = [
  './',
  './index.html',
  './pocket.html', // <-- เพิ่มหน้า Pocket ให้ใช้งานออฟไลน์ได้
  './config.js',
  './manifest.json',
  './icon-192.png',
  // ไฟล์เสียง (ถ้าไม่มีไฟล์ไหนในโปรเจกต์ ระบบจะข้ามไปอัตโนมัติ ไม่พังเหมือนเวอร์ชันก่อน)
  './hatachi-no-koi.mp3',
  './Aoi-Sangosho.mp3',
  './BookEndBossa.mp3',
  './suki-no-oto.mp3',
  './anata-no-koibito.mp3',
  './OnClick.mp3',
  './Normal-Mouse-Click.mp3'
];

const RATE_CACHE_KEY = 'necomaid-cached-rate';

// 1. Install Phase: โหลดไฟล์ทั้งหมดลง Cache เบื้องหลัง
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app shell...');
      // ใช้ allSettled เพื่อไม่ให้พังถ้าไฟล์ไหน (เช่น mp3) โหลดไม่ขึ้น
      return Promise.allSettled(
        urlsToCache.map(url => {
          return fetch(url).then(response => {
            if (!response.ok) throw new Error(`Failed to fetch ${url}`);
            if (response.redirected) {
                return fetch(response.url).then(clean => cache.put(url, clean));
            }
            return cache.put(url, response);
          }).catch(err => console.warn(`[SW] ข้ามการ Cache ไฟล์ (อาจไม่มีไฟล์นี้ในระบบ): ${url}`, err));
        })
      );
    })
  );
});

// 2. Activate Phase: ลบ Cache เวอร์ชั่นเก่าทิ้ง เพื่อรับของใหม่จาก config.js
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== RATE_CACHE_KEY) {
            console.log('[SW] Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Phase: ดักจับ Request แบบแยกโซน
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // โซน A: API เรทเงิน (Network First, Fallback to Cache)
  if (url.hostname.includes('open.er-api.com')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          const clone = networkResponse.clone();
          clone.json().then(data => {
            if (data?.rates?.THB) {
              caches.open(RATE_CACHE_KEY).then(cache => {
                cache.put(event.request, new Response(JSON.stringify(data), {
                  headers: { 'Content-Type': 'application/json' }
                }));
              });
            }
          }).catch(() => {});
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // โซน B: ไฟล์หน้าเว็บ HTML (Network First, Fallback to Cache)
  // ให้ความสำคัญกับเน็ตก่อน ถ้าคุณแก้โค้ด มันจะแสดงผลโค้ดใหม่ทันที แต่ถ้าเน็ตหลุดถึงจะไปเอา Cache มาโชว์
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // เซฟเวอร์ชันใหม่ล่าสุดลง Cache ทันทีที่เปิดเน็ตติด
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // ถ้าออฟไลน์ ให้หาหน้า HTML นั้นๆ ใน Cache
          return caches.match(event.request).then(cached => {
            // ถ้าไม่เจอหน้านั้นจริงๆ ค่อยพากลับไปหน้า index
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // โซน C: ไฟล์ทั่วไป รูปภาพ, สคริปต์, เสียง (Cache First, Fallback to Network)
  // พวกนี้ไม่ค่อยเปลี่ยนบ่อย ดึงจาก Cache เลยจะได้เปิดแอปเร็วๆ
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then(networkResponse => {
        // อนุญาต Status 200 (OK) และ 206 (Partial Content ของไฟล์เสียง)
        if (!networkResponse || (networkResponse.status !== 200 && networkResponse.status !== 206)) {
          return networkResponse;
        }
        
        // เก็บไฟล์ใหม่ๆ ที่ไม่อยู่ใน List ลง Cache ด้วย
        if (event.request.url.startsWith(self.location.origin)) {
           const clone = networkResponse.clone();
           caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        
        return networkResponse;
      }).catch(() => {
        // ออฟไลน์สนิทและไม่มีของใน Cache
        return new Response('Offline Mode - ข้อมูลนี้ไม่ได้ถูกเซฟลงเครื่อง', { 
            status: 503, 
            headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
        });
      });
    })
  );
});
