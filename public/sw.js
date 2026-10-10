// public/sw.js
// Service Worker برای سامانه نوای آسمانی (PWA Offline & Asset Caching)

const CACHE_NAME = 'nava-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
];

// نصب سرویس ورکر و کش کردن استاتیک‌های اولیه
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Could not precache some assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// فعال‌سازی و پاک‌سازی کش‌های قدیمی
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// استراتژی پاسخ‌دهی به درخواست‌ها (Network First برای API و Cache First برای استاتیک)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // نادیده گرفتن درخواست‌های وب‌سرویس مدیریتی و وب‌هوک
  if (url.pathname.startsWith('/api/admin') || url.pathname.startsWith('/api/internal') || url.pathname.startsWith('/api/bot')) {
    return;
  }

  // فایل‌های صوتی یا استاتیک: Cache First با بازگشت به شبکه
  if (url.pathname.match(/\.(mp3|m4a|png|jpg|jpeg|svg|css|js|woff2)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((networkRes) => {
          if (networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkRes;
        }).catch(() => cached);
      })
    );
    return;
  }

  // سایر درخواست‌ها: Network First با فال‌بک به کش
  event.respondWith(
    fetch(event.request)
      .then((networkRes) => {
        if (networkRes.status === 200 && event.request.method === 'GET') {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkRes;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
