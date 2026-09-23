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
      case 'synced':
        return (
          <Link
            href="/settings"
            className="cloud-status-pill synced"
            title={`Supabase Synced ${cloudInfo.lastSyncedAt ? `at ${cloudInfo.lastSyncedAt}` : ''}`}
          >
            <span>☁️</span>
            <span>Cloud</span>
          </Link>
        );
      case 'syncing':
        return (
          <Link
            href="/settings"
            className="cloud-status-pill syncing"
            title="Syncing with Supabase..."
          >
            <span>⏳</span>
            <span>Syncing</span>
          </Link>
        );
      case 'pending_setup':
        return (
          <Link
            href="/settings"
            className="cloud-status-pill pending_setup"
            title="Setup needed: Click to see SQL setup in Settings"
          >
            <span>⚠️</span>
            <span>Setup DB</span>
          </Link>
        );
      case 'offline':
        return (
          <Link
            href="/settings"
            className="cloud-status-pill offline"
            title="Offline mode: changes saved locally"
          >
            <span>📶</span>
            <span>Offline</span>
          </Link>
        );
      case 'error':
        return (
          <Link
            href="/settings"
            className="cloud-status-pill pending_setup"
            title={cloudInfo.message || 'Supabase sync issue'}
          >
            <span>⚠️</span>
            <span>Cloud Alert</span>
          </Link>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Top Header */}
      <header className="top-bar">
        <Link href="/" className="app-title-group">
          <span className="live-dot" />
          <span className="app-title">Null Gym App</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {renderCloudBadge()}

          <span
            className={`save-status-pill ${saveStatus === 'saving' ? 'saving' : 'saved'}`}
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Saved ✓'}
          </span>

          <span
            className="phase-pill"
            style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              background: 'rgba(239, 68, 68, 0.14)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              padding: '2px 7px',
              borderRadius: '999px',
            }}
          >
            4-Week Plan
          </span>
        </div>
      </header>

      {/* Bottom Floating App Navigation */}
      <nav className="bottom-nav">
        <Link
          href="/"
          className={`nav-item ${pathname === '/' ? 'active' : ''}`}
        >
          <Dumbbell size={18} />
          <span>Today</span>
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
