'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dumbbell, Calendar, BookOpen, TrendingUp, Settings, Cloud, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { onSaveStatus, initBackgroundCloudSync } from '../lib/storage';
import { onCloudStatus, CloudSyncInfo } from '../lib/supabaseSync';

export default function Navbar() {
  const pathname = usePathname();
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [cloudInfo, setCloudInfo] = useState<CloudSyncInfo>({
    status: 'syncing',
    message: 'Initializing...',
  });

  useEffect(() => {
    // Start background sync on first load
    initBackgroundCloudSync();

    const unsubSave = onSaveStatus((status) => {
      setSaveStatus(status);
    });

    const unsubCloud = onCloudStatus((info) => {
      setCloudInfo(info);
    });

    return () => {
      unsubSave();
      unsubCloud();
    };
  }, []);

  const renderCloudBadge = () => {
    switch (cloudInfo.status) {
      case 'syncing':
        return (
          <Link
            href="/settings"
            className="cloud-status-pill syncing"
            title="Saving updates to database..."
          >
            <span>🟡</span>
            <span>Syncing</span>
          </Link>
        );
      case 'offline':
        return (
          <Link
            href="/settings"
            className="cloud-status-pill offline"
            title="Offline mode: all changes saved locally"
          >
            <span>📶</span>
            <span>Offline</span>
          </Link>
        );
      case 'synced':
      default:
        return (
          <Link
            href="/settings"
            className="cloud-status-pill synced"
            title={`Database Synced ${cloudInfo.lastSyncedAt ? `· ${cloudInfo.lastSyncedAt}` : ''}`}
          >
            <span>🟢</span>
            <span>Synced</span>
          </Link>
        );
    }
  };

  return (
    <>
      {/* Top Header */}
      <header className="top-bar">
        <Link href="/" className="app-title-group">
          <span className="live-dot" />
          <span className="app-title">Null Gym</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {saveStatus === 'saving' ? (
            <span className="cloud-status-pill syncing">
              <span>🟡</span>
              <span>Saving...</span>
            </span>
          ) : (
            <Link
              href="/settings"
              className="cloud-status-pill synced"
              title="Workouts saved and synchronized"
            >
              <span>🟢</span>
              <span>Synced</span>
            </Link>
          )}

          <Link
            href="/settings"
            className="icon-action-btn"
            style={{ width: '28px', height: '28px', borderRadius: '50%', color: 'var(--text-muted)' }}
            title="App Settings &amp; Install"
          >
            <Settings size={14} />
          </Link>
        </div>
      </header>

      {/* Bottom Floating App Navigation */}
      <nav className="bottom-nav">
        <Link
          href="/"
          className={`nav-item ${pathname === '/' ? 'active' : ''}`}
        >
          <Dumbbell size={18} />
          <span>Workout</span>
        </Link>
        <Link
          href="/planner"
          className={`nav-item ${pathname === '/planner' ? 'active' : ''}`}
        >
          <Calendar size={18} />
          <span>Planner</span>
        </Link>
        <Link
          href="/library"
          className={`nav-item ${pathname === '/library' ? 'active' : ''}`}
        >
          <BookOpen size={18} />
          <span>Library</span>
        </Link>
        <Link
          href="/progress"
          className={`nav-item ${pathname === '/progress' ? 'active' : ''}`}
        >
          <TrendingUp size={18} />
          <span>Progress</span>
        </Link>
        <Link
          href="/settings"
          className={`nav-item ${pathname === '/settings' ? 'active' : ''}`}
        >
          <Settings size={18} />
          <span>Settings</span>
        </Link>
      </nav>
    </>
  );
}
