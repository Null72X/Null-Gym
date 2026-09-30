'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dumbbell, Calendar, BookOpen, TrendingUp, Settings, Cloud, Check, AlertCircle, RefreshCw, Sparkles, LogOut, User } from 'lucide-react';
import { initBackgroundCloudSync } from '../lib/storage';
import { onCloudStatus, getCloudSyncInfo, CloudSyncInfo } from '../lib/supabaseSync';
import { isAppOffline, onOfflineChange } from '../lib/offlineManager';
import { onOutboxCountChange } from '../lib/outboxQueue';
import { initAuth, onAuthChange, signOutUser, AppUser, isUserAdmin } from '../lib/authService';

export default function Navbar() {
  const pathname = usePathname();
  const [cloudInfo, setCloudInfo] = useState<CloudSyncInfo>(() => getCloudSyncInfo());
  const [isOffline, setIsOffline] = useState<boolean>(() => isAppOffline());
  const [pendingOutbox, setPendingOutbox] = useState<number>(0);
  const [user, setUser] = useState<AppUser | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Do not render Navbar on public auth routes
  if (pathname === '/login' || pathname === '/auth/callback') {
    return null;
  }

  const isAdmin = isUserAdmin(user);

  useEffect(() => {
    // Start background sync and auth on first load
    initBackgroundCloudSync();
    initAuth();

    const unsubAuth = onAuthChange((u) => {
      setUser(u);
    });

    const unsubCloud = onCloudStatus((info) => {
      setCloudInfo(info);
    });

    const unsubOffline = onOfflineChange((offline) => {
      setIsOffline(offline);
    });

    const unsubOutbox = onOutboxCountChange((count) => {
      setPendingOutbox(count);
    });

    return () => {
      unsubAuth();
      unsubCloud();
      unsubOffline();
      unsubOutbox();
    };
  }, []);

  const renderCloudBadge = () => {
    if (isOffline || cloudInfo.status === 'offline') {
      return (
        <Link
          href="/settings"
          className="cloud-status-pill offline"
          title={pendingOutbox > 0 ? `${pendingOutbox} updates queued locally. Will auto-sync when online.` : "Offline mode active: all changes saved locally"}
        >
          <span>📶</span>
          <span>{pendingOutbox > 0 ? `Offline (${pendingOutbox})` : 'Offline'}</span>
        </Link>
      );
    }
    switch (cloudInfo.status) {
      case 'needs_rls_fix':
        if (isAdmin) {
          return (
            <Link
              href="/settings"
              className="cloud-status-pill needs_rls_fix"
              title="Admin Alert: Supabase RLS is blocking writes. Tap to fix in Settings."
            >
              <span>⚠️</span>
              <span>Setup Needed</span>
            </Link>
          );
        }
        return (
          <Link
            href="/settings"
            className="cloud-status-pill synced"
            title="Database Ready & Synced"
          >
            <span>🟢</span>
            <span>Synced</span>
          </Link>
        );
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
      case 'error':
        return (
          <Link
            href="/settings"
            className="cloud-status-pill error"
            title={cloudInfo.message || 'Sync issue. Saved locally.'}
          >
            <span>🔴</span>
            <span>Sync Alert</span>
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

        {/* Desktop Header Navigation (Visible on tablet & desktop >= 768px) */}
        <nav className="desktop-nav" aria-label="Main Navigation">
          <Link
            href="/"
            className={`desktop-nav-link ${pathname === '/' ? 'active' : ''}`}
          >
            <Dumbbell size={15} />
            <span>Workout</span>
          </Link>
          <Link
            href="/planner"
            className={`desktop-nav-link ${pathname === '/planner' ? 'active' : ''}`}
          >
            <Calendar size={15} />
            <span>Planner</span>
          </Link>
          <Link
            href="/library"
            className={`desktop-nav-link ${pathname === '/library' ? 'active' : ''}`}
          >
            <BookOpen size={15} />
            <span>Library</span>
          </Link>
          <Link
            href="/progress"
            className={`desktop-nav-link ${pathname === '/progress' ? 'active' : ''}`}
          >
            <TrendingUp size={15} />
            <span>Progress</span>
          </Link>
          <Link
            href="/settings"
            className={`desktop-nav-link ${pathname === '/settings' ? 'active' : ''}`}
          >
            <Settings size={15} />
            <span>Settings</span>
          </Link>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          {renderCloudBadge()}

          {user ? (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 8px 3px 4px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 'var(--radius)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                }}
                title={isAdmin ? `👑 Administrator (${user.email})` : `Signed in as ${user.name} (${user.email})`}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: isAdmin ? '#eab308' : 'var(--accent-red)',
                      color: isAdmin ? '#000' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                    }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ maxWidth: '75px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name.split(' ')[0]}
                </span>
                {isAdmin && (
                  <span title="Administrator" style={{ fontSize: '0.65rem' }}>👑</span>
                )}
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      zIndex: 999,
                      background: '#0e121b',
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      borderRadius: 'var(--radius)',
                      padding: '12px',
                      width: '220px',
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
                    }}
                  >
                    <div style={{ marginBottom: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>{user.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user.email}
                      </div>
                      {isAdmin ? (
                        <div style={{ fontSize: '0.64rem', color: '#fde047', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                          <span>👑</span>
                          <span>Administrator</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.64rem', color: '#86efac', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>●</span>
                          <span>Private Cloud Account</span>
                        </div>
                      )}
                    </div>

                    <Link
                      href="/settings"
                      onClick={() => setShowUserMenu(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        color: '#cbd5e1',
                        textDecoration: 'none',
                        fontSize: '0.75rem',
                        borderRadius: 'var(--radius)',
                      }}
                    >
                      <Settings size={14} />
                      <span>Account &amp; Settings</span>
                    </Link>

                    <button
                      type="button"
                      onClick={async () => {
                        setShowUserMenu(false);
                        await signOutUser();
                        window.location.href = '/login';
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        background: 'none',
                        border: 'none',
                        color: '#f87171',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius)',
                        textAlign: 'left',
                      }}
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: 'var(--radius)',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: 700,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
              title="Sign In with Google"
            >
              <Sparkles size={12} color="var(--accent-red)" />
              <span>Sign In</span>
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
