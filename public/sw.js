// Null Gym Service Worker - Offline & PWA Engine
const CACHE_NAME = 'null-gym-cache-v1';
const MEDIA_CACHE_NAME = 'null-gym-media-v1';

const STATIC_PRECACHE = [
  '/',
  '/planner',
  '/library',
  '/progress',
  '/settings',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// Install Event - Precache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PRECACHE).catch((err) => {
        console.warn('[SW] Some precache items could not be loaded immediately:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== MEDIA_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Offline-first with intelligent caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests and Supabase auth/sync endpoints
  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;

  // 2. Exercise media (GIFs, thumbnails, CDN assets) -> Cache First
  if (
    url.hostname.includes('jsdelivr.net') ||
    url.pathname.endsWith('.gif') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg')
  ) {
    event.respondWith(
      caches.open(MEDIA_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Return cached or fallback if offline
            return cachedResponse || new Response('', { status: 408, statusText: 'Offline' });
          });
        });
      })
    );
    return;
  }

  // 3. Static scripts, CSS, fonts (_next/static, fonts.googleapis, etc.) -> Cache First with network update
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            if (res && res.status === 200) {
              cache.put(request, res.clone());
            }
            return res;
          });
        });
      })
    );
    return;
  }

  // 4. HTML Navigation / Page Routes -> Network First, fall back to cached page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      }).catch(async () => {
        // Fallback to cache when offline
        const cached = await caches.match(request);
        if (cached) return cached;
        // Fallback to home page shell
        const homeCached = await caches.match('/');
        if (homeCached) return homeCached;
        return new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Null Gym · Offline</title><meta name="viewport" content="width=device-width, initial-scale=1"/><style>body{background:#070709;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center;}.box{background:#11141c;border:1px solid rgba(255,255,255,0.1);padding:30px;border-radius:14px;max-width:380px;}button{background:#ef4444;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-weight:700;cursor:pointer;margin-top:14px;}</style></head><body><div class="box"><h2>📶 Offline Mode Active</h2><p>Null Gym is working offline. All your workout tracking, sets, timers, and planner are saved locally.</p><button onclick="location.reload()">Reload App</button></div></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      })
    );
    return;
  }

  // Default fallback
  event.respondWith(
    caches.match(request).then((response) => response || fetch(request))
  );
});
