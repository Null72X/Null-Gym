'use client';

type OfflineListener = (isOffline: boolean) => void;
const listeners: Set<OfflineListener> = new Set();

const FORCED_OFFLINE_KEY = 'nullgym_force_offline_mode';

let forcedOffline = false;
if (typeof window !== 'undefined') {
  try {
    forcedOffline = localStorage.getItem(FORCED_OFFLINE_KEY) === 'true';
  } catch {}
}

export function isForcedOffline(): boolean {
  return forcedOffline;
}

export function isAppOffline(): boolean {
  if (typeof window === 'undefined') return false;
  return forcedOffline || !navigator.onLine;
}

export function setForcedOffline(enabled: boolean): void {
  forcedOffline = enabled;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(FORCED_OFFLINE_KEY, enabled ? 'true' : 'false');
    } catch {}
  }
  emitChange();
}

function emitChange() {
  const offline = isAppOffline();
  listeners.forEach((listener) => {
    try {
      listener(offline);
    } catch (err) {
      console.error('[OfflineManager] Error in listener:', err);
    }
  });
}

// Window online/offline event handlers
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    emitChange();
  });
  window.addEventListener('offline', () => {
    emitChange();
  });
}

export function onOfflineChange(listener: OfflineListener): () => void {
  listeners.add(listener);
  // Immediate invocation with current state
  try {
    listener(isAppOffline());
  } catch {}
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Register Service Worker for PWA and full offline functionality
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Check for updates periodically
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] New version available.');
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
  });
}

/**
 * Clear cached service worker caches
 */
export async function clearOfflineCache(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
  console.log('[SW] All offline caches cleared.');
}

/**
 * Estimate offline media cache stats
 */
export async function getOfflineCacheStats(): Promise<{ cachedMedia: number; cacheSizeMb: string }> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { cachedMedia: 0, cacheSizeMb: '0.0' };
  }
  try {
    const mediaCache = await caches.open('null-gym-media-v1');
    const keys = await mediaCache.keys();
    let totalSize = 0;
    // Estimate size
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      totalSize = estimate.usage || 0;
    }
    const sizeMb = (totalSize / (1024 * 1024)).toFixed(1);
    return {
      cachedMedia: keys.length,
      cacheSizeMb: sizeMb,
    };
  } catch {
    return { cachedMedia: 0, cacheSizeMb: '0.0' };
  }
}
