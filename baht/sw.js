/**
 * NecoMart THB Service Worker
 * ออกแบบมาเพื่อรองรับการใช้งาน Offline แบบ PWA
 */

importScripts('./config.js');

// ปรับให้มีเฉพาะไฟล์ที่ใช้งานจริง (ทั้งหมด self-hosted แล้ว ไม่พึ่ง CDN ภายนอก)
const urlsToCache = [
  './',
  './index.html',
  './config.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // ===== Vendor assets (self-hosted แทน CDN) =====
  './vendor/tailwind/tailwind.min.css',
  './vendor/html2canvas/html2canvas.min.js',
  './vendor/firebase/firebase-bundle.min.js',
  './vendor/fonts/sarabun/sarabun.css',
  './vendor/fonts/space-mono/space-mono.css',
  './vendor/fonts/sarabun/sarabun-thai-100-normal.woff2',
  './vendor/fonts/sarabun/sarabun-thai-300-normal.woff2',
  './vendor/fonts/sarabun/sarabun-thai-400-normal.woff2',
  './vendor/fonts/sarabun/sarabun-thai-700-normal.woff2',
  './vendor/fonts/sarabun/sarabun-thai-800-normal.woff2',
  './vendor/fonts/sarabun/sarabun-latin-100-normal.woff2',
  './vendor/fonts/sarabun/sarabun-latin-300-normal.woff2',
  './vendor/fonts/sarabun/sarabun-latin-400-normal.woff2',
  './vendor/fonts/sarabun/sarabun-latin-700-normal.woff2',
  './vendor/fonts/sarabun/sarabun-latin-800-normal.woff2',
  './vendor/fonts/sarabun/sarabun-latin-ext-100-normal.woff2',
  './vendor/fonts/sarabun/sarabun-latin-ext-300-normal.woff2',
  './vendor/fonts/sarabun/sarabun-latin-ext-400-normal.woff2',
  './vendor/fonts/sarabun/sarabun-latin-ext-700-normal.woff2',
  './vendor/fonts/sarabun/sarabun-latin-ext-800-normal.woff2',
  './vendor/fonts/space-mono/space-mono-latin-400-normal.woff2',
  './vendor/fonts/space-mono/space-mono-latin-700-normal.woff2',
  './vendor/fonts/space-mono/space-mono-latin-ext-400-normal.woff2',
  './vendor/fonts/space-mono/space-mono-latin-ext-700-normal.woff2'
];

const RATE_CACHE_KEY = 'necomaid-cached-rate-thb';

// 1. ติดตั้ง: เก็บไฟล์แอสเซทแบบขนาน (Promise.all) เบื้องหลัง
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(
        urlsToCache.map(url => {
          return fetch(url)
            .then(response => {
              if (!response.ok) throw new Error('Failed: ' + url);
              // จัดการกรณีโฮสต์ทำการ Redirect (ป้องกัน error opaque responses)
              if (response.redirected) {
                return fetch(response.url).then(clean => cache.put(url, clean));
              }
              return cache.put(url, response);
            })
            .catch(err => console.warn('SW: ข้ามการ Cache ->', url, err));
        })
      );
    })
  );
});

// 2. เปิดใช้งาน: ลบ Cache เวอร์ชั่นเก่าทิ้งทั้งหมดเพื่อรับอัปเดตใหม่
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 3. ดักจับ Request: แยกการจัดการระหว่าง API และ ไฟล์ทั่วไป
self.addEventListener('fetch', event => {
  // สำคัญ: ให้ทำ Cache เฉพาะการขอข้อมูลแบบ GET เท่านั้น
  if (event.request.method !== 'GET') return;

  // โซน A: จัดการ API เรทเงิน (Network First, Fallback to Cache)
  if (event.request.url.includes('open.er-api.com')) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        const clone = networkResponse.clone();
        clone.json().then(data => {
          // ดึงค่า API ของ THB มา และเราต้องการหา JPY (ตามที่มีใน index.html)
          if (data?.rates?.JPY) {
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

  // โซน B: จัดการไฟล์ทั่วไป (Cache First, Fallback to Network)
  event.respondWith(
    caches.match(event.request).then(cached => {
      // ถ้ามีใน Cache ให้ดึงมาใช้ทันที
      if (cached) return cached;
      
      // ถ้าไม่มีให้ไปดึงจาก Network
      return fetch(event.request).then(res => {
        if (!res || res.status !== 200) return res;
        
        // ถ้าไฟล์ถูก Redirect มา ให้ตามไปดึง URL ปลายทาง
        if (res.redirected) return fetch(res.url);
        return res;
      }).catch(() => {
        // กรณีออฟไลน์สนิทและไม่มีข้อมูลใน Cache
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline Mode - ขออภัย ข้อมูลนี้ยังไม่ถูกบันทึกลงเครื่อง', { 
            status: 503, 
            headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
        });
      });
    })
  );
});