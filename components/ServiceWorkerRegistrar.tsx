'use client';

import { useEffect, useState } from 'react';
import { registerServiceWorker, onOfflineChange } from '../lib/offlineManager';
import { WifiOff, Wifi } from 'lucide-react';

export default function ServiceWorkerRegistrar() {
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  useEffect(() => {
    registerServiceWorker();

    let initial = true;
    const unsub = onOfflineChange((isOffline) => {
      if (initial) {
        initial = false;
        return;
      }
      if (isOffline) {
        setOfflineNotice('Offline mode active. All workout tracking and plans are saved locally.');
        setTimeout(() => setOfflineNotice(null), 4000);
      } else {
        setOfflineNotice('Back online. Syncing data...');
        setTimeout(() => setOfflineNotice(null), 3000);
      }
    });

    return () => unsub();
  }, []);

  if (!offlineNotice) return null;

  const isOffline = offlineNotice.includes('Offline');

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99998,
        background: isOffline ? '#181b24' : 'rgba(16, 185, 129, 0.95)',
        border: `1px solid ${isOffline ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
        color: isOffline ? '#fef3c7' : '#ffffff',
        padding: '8px 16px',
        borderRadius: '24px',
        fontSize: '0.75rem',
        fontWeight: 600,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        maxWidth: '90vw',
        animation: 'modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'none',
      }}
    >
      {isOffline ? (
        <WifiOff size={14} color="#fbbf24" style={{ flexShrink: 0 }} />
      ) : (
        <Wifi size={14} color="#ffffff" style={{ flexShrink: 0 }} />
      )}
      <span>{offlineNotice}</span>
    </div>
  );
}
