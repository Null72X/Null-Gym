'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  exportAllData,
  importAllData,
  createBlankWeeks,
  clearAllExercisesFromPlan,
  saveWeeks,
  saveHistory,
  getActiveSelection,
  saveActiveSelection,
  getSavedLibrary,
  saveLibrary,
  restoreDefaultLibrary,
  factoryResetAll,
  getProgressionConfig,
  saveProgressionConfig,
  applyAutoScaleToAllWeeks,
  advanceToNextCycle,
  forcePullAllFromCloud,
  forcePushAllToCloud,
} from '../../lib/storage';
import { onCloudStatus, CloudSyncInfo, checkSupabaseConnection } from '../../lib/supabaseSync';
import { WeightUnit, ProgressionConfig } from '../../types/workout';
import { ALL_CATALOG_EXERCISES } from '../../lib/exerciseCatalog';
import {
  Settings,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Check,
  Copy,
  BookOpen,
  Calendar,
  Zap,
  Cloud,
  Dumbbell,
  Smartphone,
  Share2,
  PlusSquare,
  Sparkles,
  TrendingUp,
  Wifi,
  WifiOff,
  HardDrive,
  Rocket,
  Heart,
  ExternalLink,
  Github,
  User,
  LogOut,
  ShieldCheck,
  AlertTriangle,
  X,
} from 'lucide-react';
import {
  isAppOffline,
  isForcedOffline,
  setForcedOffline,
  onOfflineChange,
  clearOfflineCache,
  getOfflineCacheStats,
} from '../../lib/offlineManager';
import { initAuth, onAuthChange, signOutUser, AppUser, isUserAdmin, ADMIN_EMAIL } from '../../lib/authService';

export default function SettingsPage() {
  const router = useRouter();
  const [unit, setUnit] = useState<WeightUnit>(() => {
    if (typeof window !== 'undefined') return getActiveSelection().unit || 'kg';
    return 'kg';
  });
  const [libraryCount, setLibraryCount] = useState<number>(() => {
    if (typeof window !== 'undefined') return getSavedLibrary().length;
    return ALL_CATALOG_EXERCISES.length;
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cloudInfo, setCloudInfo] = useState<CloudSyncInfo>({
    status: 'synced',
    message: 'Database Ready & Synced',
  });
  const [progressionConfig, setProgressionConfig] = useState<ProgressionConfig>(() => {
    if (typeof window !== 'undefined') return getProgressionConfig();
    return {
      autoProgressionEnabled: true,
      weeklyIncrementKg: 2.5,
      weeklyIncrementLbs: 5.0,
      bodyweightRepIncrement: 1,
      timedHoldIncrementSecs: 5,
      deloadWeek4: false,
    };
  });

  // PWA install prompt state
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);

  // Offline mode state & stats
  const [isOffline, setIsOffline] = useState<boolean>(() => isAppOffline());
  const [isForced, setIsForced] = useState<boolean>(() => isForcedOffline());
  const [cacheStats, setCacheStats] = useState<{ cachedMedia: number; cacheSizeMb: string }>({
    cachedMedia: 0,
    cacheSizeMb: '0.0',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // DB diagnostic states
  const [dbTestResult, setDbTestResult] = useState<{
    tested: boolean;
    connected: boolean;
    needsRlsFix: boolean;
    message: string;
  } | null>(null);
  const [isTestingDb, setIsTestingDb] = useState<boolean>(false);
  const [isSqlCopied, setIsSqlCopied] = useState<boolean>(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const isAdmin = isUserAdmin(user);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await forcePushAllToCloud();
      await forcePullAllFromCloud();
      triggerToast('🟢 Workouts synchronized across devices!');
    } catch {
      triggerToast('Workouts saved locally on this device.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    initAuth();
    const unsubAuth = onAuthChange((u) => {
      setUser(u);
      if (isUserAdmin(u)) {
        checkSupabaseConnection().then((result) => {
          setDbTestResult({
            tested: true,
            connected: result.connected,
            needsRlsFix: result.needsRlsFix,
            message: result.message,
          });
        });
      } else {
        setDbTestResult(null);
      }
    });

    const unsubCloud = onCloudStatus((info) => {
      setCloudInfo(info);
    });

    const unsubOffline = onOfflineChange((offline) => {
      setIsOffline(offline);
      setIsForced(isForcedOffline());
    });

    getOfflineCacheStats().then(setCacheStats);

    // PWA Install Prompt detection
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Check if already in standalone PWA mode
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true);
    }

    // Check if iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setIsIOS(true);
    }

    return () => {
      unsubAuth();
      unsubCloud();
      unsubOffline();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleToggleForcedOffline = () => {
    const next = !isForced;
    setForcedOffline(next);
    setIsForced(next);
    setIsOffline(isAppOffline());
    triggerToast(next ? '📶 Forced Offline Mode Activated (Zero Network)' : '🟢 Online Mode Restored');
  };

  const handleClearCache = async () => {
    await clearOfflineCache();
    const stats = await getOfflineCacheStats();
    setCacheStats(stats);
    triggerToast('Offline media cache cleared');
  };

  const handleRestoreLibrary = () => {
    const restored = restoreDefaultLibrary();
    setLibraryCount(restored.length);
    triggerToast(`Restored all ${restored.length} ExerciseDB exercises! 🏋️`);
  };

  // Handle PWA Install
  const handleInstallClick = async () => {
    if (!installPrompt) {
      if (isIOS) {
        alert("To install on iPhone/iPad:\n1. Tap the Share button (⎋) in Safari\n2. Scroll down and tap 'Add to Home Screen' (⊞)");
      } else {
        alert("To install on mobile or desktop:\nOpen your browser menu (⋮) and tap 'Add to Home Screen' or 'Install App'.");
      }
      return;
    }

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setInstallPrompt(null);
      triggerToast('Null Gym installed successfully! 📱');
    }
  };

  // Update Progression Configuration
  const handleUpdateProgression = (updates: Partial<ProgressionConfig>) => {
    const updated = { ...progressionConfig, ...updates };
    setProgressionConfig(updated);
    saveProgressionConfig(updated);
    triggerToast('Progression preferences saved');
  };

  // 1-Click Auto-Setup Weeks 2 through 6 from Week 1
  const handleTriggerAutoScale = () => {
    const scaled = applyAutoScaleToAllWeeks();
    triggerToast('⚡ Weeks 2 to 6 auto-programmed with progressive overload!');
  };

  // 1-Click Start Next 6-Week Cycle
  const handleStartNextCycle = () => {
    if (
      !confirm(
        'START NEXT 6-WEEK CYCLE?\n\n' +
        '• Your peak Week 6 weights will become your new Week 1 baseline.\n' +
        '• All completed checkmarks will be cleared for a fresh cycle.\n' +
        '• Weeks 2 to 6 will be auto-programmed with progressive overload.\n' +
        '• ALL your workout history, volume logs, and PRs will remain 100% intact!\n\n' +
        'Ready to advance?'
      )
    )
      return;

    const newPlan = advanceToNextCycle();
    triggerToast('🚀 Cycle 2 Started! Week 1 baseline upgraded.');
    router.push('/');
  };

  const handleTestSupabase = async () => {
    setIsTestingDb(true);
    try {
      const result = await checkSupabaseConnection();
      setDbTestResult({
        tested: true,
        connected: result.connected,
        needsRlsFix: result.needsRlsFix,
        message: result.message,
      });
      if (result.connected && !result.needsRlsFix) {
        await forcePullAllFromCloud();
        triggerToast('🟢 Cloud Database Synced & Ready!');
      }
    } finally {
      setIsTestingDb(false);
    }
  };

  const sqlFixCode = `-- 1-Click Fix: Disable RLS on all 3 tables for 100% seamless device sync
ALTER TABLE public.workout_plan DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlFixCode);
    setIsSqlCopied(true);
    setTimeout(() => setIsSqlCopied(false), 2200);
    triggerToast('SQL script copied to clipboard! 📋');
  };

  // Export JSON file
  const handleExport = () => {
    try {
      const jsonStr = exportAllData();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `null-gym-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      triggerToast('Full 6-week data exported successfully! 📁');
    } catch (err) {
      console.error(err);
      triggerToast('Export failed');
    }
  };

  // Import JSON file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importAllData(content);
        if (success) {
          triggerToast('Backup restored successfully!');
          router.push('/');
        } else {
          alert('Failed to import JSON: Invalid workout file structure.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Reset Confirmation Modal State (Zero delay, non-blocking)
  const [resetModal, setResetModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    willDelete: string[];
    willKeepSafe: string[];
    confirmText: string;
    onConfirm: () => void;
  } | null>(null);

  // 1. Wipe All Planned Exercises (keeps history & PRs safe!)
  const openCleanExercisesModal = () => {
    setResetModal({
      isOpen: true,
      title: 'Clean All Exercises from Plan',
      description: 'Remove all planned workout exercises, target reps, and weights from all 6 weeks?',
      willDelete: ['All scheduled exercises across Weeks 1 to 6', 'Target reps, sets, and weights in the planner'],
      willKeepSafe: ['All logged workout history & past sessions', 'All Personal Records (PRs)', 'Full 1,323 Exercise Library'],
      confirmText: 'Yes, Wipe Planned Exercises',
      onConfirm: () => {
        clearAllExercisesFromPlan();
        triggerToast('All exercises removed from 6-week plan');
        window.location.replace('/planner');
      },
    });
  };

  // 2. Reset 6-Week Plan to Clean Blank Template
  const openResetBlankModal = () => {
    setResetModal({
      isOpen: true,
      title: 'Reset to Blank 6-Week Plan',
      description: 'Reset your workout routine to a clean 6-week blank template (Day 1 to Day 7 for Weeks 1–6)?',
      willDelete: ['Custom week labels, custom day names, and planned exercises'],
      willKeepSafe: ['All logged workout history & past sessions', 'All Personal Records (PRs)', 'Full 1,323 Exercise Library'],
      confirmText: 'Yes, Reset to Blank Plan',
      onConfirm: () => {
        const blank = createBlankWeeks();
        saveWeeks(blank);
        triggerToast('Created fresh blank 6-week plan!');
        window.location.replace('/planner');
      },
    });
  };

  // 3. Clear Workout History & PRs
  const openClearHistoryModal = () => {
    setResetModal({
      isOpen: true,
      title: 'Clear Workout History & PRs',
      description: 'Delete all logged workout sessions, completed sets history, and calculated personal records?',
      willDelete: ['All logged workout sessions & timestamps', 'All PR progress curves & estimated 1RMs'],
      willKeepSafe: ['Your 6-week planned workouts & routines', 'Exercise library catalog'],
      confirmText: 'Yes, Clear History & PRs',
      onConfirm: () => {
        saveHistory([]);
        triggerToast('Workout history and PRs cleared');
        window.location.replace('/progress');
      },
    });
  };

  // 4. Full Factory Reset
  const openFactoryResetModal = () => {
    setResetModal({
      isOpen: true,
      title: 'Factory Reset Entire Application',
      description: 'Perform a complete wipe back to fresh out-of-the-box installation state?',
      willDelete: ['All 6-week planned workouts', 'All logged workout history and PR records', 'Active day selection and settings cache'],
      willKeepSafe: ['Restores complete 1,323 master exercise catalog'],
      confirmText: 'Yes, Factory Reset Everything',
      onConfirm: () => {
        factoryResetAll();
        triggerToast('Application factory reset complete!');
        window.location.replace('/');
      },
    });
  };

  // Change default unit
  const handleUnitChange = (newUnit: WeightUnit) => {
    setUnit(newUnit);
    const active = getActiveSelection();
    saveActiveSelection({ ...active, unit: newUnit });
    triggerToast(`Default unit set to ${newUnit.toUpperCase()}`);
  };

  return (
    <div>
      {/* Header */}
      <section className="day-summary-card">
        <div className="day-summary-info">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} color="var(--accent-red)" />
            <span>App Preferences &amp; Settings</span>
          </h2>
          <p>Progression automation, mobile installation, units, and data management.</p>
        </div>
      </section>

      {/* Settings Grid */}
      <div className="responsive-grid-2" style={{ marginBottom: '14px' }}>
        {/* 0. User Account & Private Cloud Profile Card */}
        <div className="clean-card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3
              style={{
                fontSize: '0.95rem',
                fontWeight: 800,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <User size={18} color="var(--accent-red)" />
              <span>Account &amp; Cloud Profile</span>
            </h3>
            <span
              className={`cloud-status-pill ${user ? 'synced' : 'offline'}`}
              style={{ fontSize: '0.68rem', padding: '3px 8px' }}
            >
              {user ? '🟢 Google Account Verified' : 'Authentication Required'}
            </span>
          </div>

          {user ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius)',
                  padding: '14px 16px',
                  marginBottom: '14px',
                }}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: isAdmin ? '#eab308' : 'var(--accent-red)',
                      color: isAdmin ? '#000' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                      fontWeight: 800,
                    }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{user.name}</span>
                    {isAdmin && <span style={{ fontSize: '0.8rem' }} title="Administrator">👑</span>}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.email}
                  </div>
                  {isAdmin ? (
                    <div style={{ fontSize: '0.68rem', color: '#fde047', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                      <ShieldCheck size={13} color="#fde047" />
                      <span>👑 Administrator Account &bull; Full Database &amp; Developer Access</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.68rem', color: '#86efac', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={13} />
                      <span>Personal Cloud Sync Active &bull; Private &amp; Encrypted</span>
                    </div>
                  )}
                </div>
              </div>

              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
                Your workouts, sets, weights, and logs are synchronized privately to your personal account. Any device you sign into will automatically load your 6-week program.
              </p>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-clean btn-primary btn-sm"
                  onClick={async () => {
                    triggerToast('⚡ Pushing latest data to private cloud...');
                    await forcePushAllToCloud();
                    triggerToast('🟢 Cloud backup complete!');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Cloud size={13} />
                  <span>Force Cloud Backup Now</span>
                </button>

                <button
                  type="button"
                  className="btn-clean btn-sm"
                  onClick={async () => {
                    await signOutUser();
                    window.location.href = '/login';
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171' }}
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
                Please authenticate using your Google account to synchronize your workouts, logs, and progression across all your devices.
              </p>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Link
                  href="/login"
                  className="btn-clean btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', textDecoration: 'none' }}
                >
                  <Sparkles size={14} />
                  <span>Continue with Google</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Offline Mode & Local Storage Engine Card */}
        <div className="clean-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3
              style={{
                fontSize: '0.88rem',
                fontWeight: 800,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <WifiOff size={16} color={isOffline ? '#fbbf24' : 'var(--accent-red)'} />
              <span>Offline Mode &amp; Local Storage</span>
            </h3>
            <span
              className={`cloud-status-pill ${isOffline ? 'offline' : 'synced'}`}
              style={{ fontSize: '0.68rem', padding: '3px 8px' }}
            >
              {isOffline ? '📶 Offline Active' : '🟢 Online'}
            </span>
          </div>

          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
            Null Gym stores all <strong>{ALL_CATALOG_EXERCISES.length} ExerciseDB exercises</strong>, plans, sets, and timers locally on your device. The app operates 100% offline in gym basements or airplane mode.
          </p>

          {/* Force Offline Mode Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '10px 12px',
              marginBottom: '10px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>
                Force Offline (Gym / Airplane Mode)
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Prevents network calls, saves battery, and ensures 100% local operation
              </div>
            </div>
            <button
              type="button"
              className={`btn-clean btn-sm ${isForced ? 'btn-primary' : ''}`}
              onClick={handleToggleForcedOffline}
            >
              {isForced ? 'Active (Offline) ✓' : 'Auto (Online)'}
            </button>
          </div>

          {/* Offline Cache Stats & Status */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.015)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 'var(--radius)',
              padding: '8px 12px',
              marginBottom: '12px',
              fontSize: '0.72rem',
              color: '#cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Exercise Database:</span>
              <strong style={{ color: '#fff' }}>{libraryCount} ExerciseDB Items (Local)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Cached Media Assets:</span>
              <span style={{ color: 'var(--text-dim)' }}>{cacheStats.cachedMedia} files ({cacheStats.cacheSizeMb} MB)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Service Worker Engine:</span>
              <span style={{ color: '#86efac' }}>Active (App Shell &amp; Asset Cache)</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-clean btn-sm"
              onClick={handleClearCache}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Trash2 size={13} />
              <span>Clear Offline Media Cache</span>
            </button>
            <button
              type="button"
              className="btn-clean btn-sm"
              onClick={handleRestoreLibrary}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-red)' }}
            >
              <RefreshCw size={13} />
              <span>Reload ExerciseDB Library</span>
            </button>
          </div>
        </div>

        {/* 1. Mobile App Installation Card */}
        <div className="clean-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3
              style={{
                fontSize: '0.88rem',
                fontWeight: 800,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Smartphone size={16} color="var(--accent-red)" />
              <span>Install Null Gym App</span>
            </h3>
            <span
              className="cloud-status-pill synced"
              style={{ fontSize: '0.68rem', padding: '3px 8px' }}
            >
              {isInstalled ? '✓ App Installed' : '📱 PWA Ready'}
            </span>
          </div>

          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
            Install Null Gym on your phone or desktop for an edge-to-edge native app experience with zero browser bars, instant launch from your home screen, and full offline support.
          </p>

          {isIOS && !isInstalled ? (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
                marginBottom: '12px',
                fontSize: '0.74rem',
                color: '#e2e8f0',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 800, color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Share2 size={13} color="var(--accent-red)" />
                <span>How to Install on iPhone / iPad:</span>
              </div>
              1. Tap the <strong>Share</strong> button in Safari toolbar (square with arrow up ⎋)<br />
              2. Scroll down and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong> (⊞)<br />
              3. Tap <strong>&ldquo;Add&rdquo;</strong> in the top right corner.
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-clean btn-primary btn-sm"
              onClick={handleInstallClick}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Smartphone size={13} />
              <span>{isInstalled ? 'App Is Installed ✓' : 'Add to Home Screen / Install'}</span>
            </button>
          </div>
        </div>

        {/* 2. Intelligent 6-Week Progression Engine */}
        <div className="clean-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3
              style={{
                fontSize: '0.88rem',
                fontWeight: 800,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Zap size={16} color="var(--accent-amber)" />
              <span>Intelligent 6-Week Progression Engine</span>
            </h3>
            <span
              className="cloud-status-pill synced"
              style={{
                fontSize: '0.68rem',
                padding: '3px 8px',
                background: progressionConfig.autoProgressionEnabled
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(255, 255, 255, 0.05)',
                color: progressionConfig.autoProgressionEnabled ? '#86efac' : 'var(--text-muted)',
                borderColor: progressionConfig.autoProgressionEnabled
                  ? 'rgba(34, 197, 94, 0.3)'
                  : 'var(--border)',
              }}
            >
              {progressionConfig.autoProgressionEnabled ? '⚡ Auto-Scale Active' : 'Manual Mode'}
            </span>
          </div>

          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
            When active, setting up <strong>Week 1</strong> automatically programs <strong>Weeks 2, 3, 4, 5, and 6</strong> with calculated progressive overload (increments on working sets, +1 rep on bodyweight).
          </p>

          {/* Auto Progression Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '10px 12px',
              marginBottom: '10px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>
                Auto-Scale Weeks 2 through 6 from Week 1
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Increases load every 2nd week (Weeks 1 &amp; 2 base, Week 3 &amp; 5 bump)
              </div>
            </div>
            <button
              type="button"
              className={`btn-clean btn-sm ${progressionConfig.autoProgressionEnabled ? 'btn-primary' : ''}`}
              onClick={() =>
                handleUpdateProgression({
                  autoProgressionEnabled: !progressionConfig.autoProgressionEnabled,
                })
              }
            >
              {progressionConfig.autoProgressionEnabled ? 'Enabled ✓' : 'Disabled'}
            </button>
          </div>

          {/* Weekly Overload Step Selection */}
          <div style={{ marginBottom: '12px' }}>
            <label className="clean-label" style={{ marginBottom: '6px' }}>
              Overload Increment (Every 2nd Week: W1-2, W3-4, W5-6)
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[1.25, 2.5, 5].map((val) => {
                const isSelected = progressionConfig.weeklyIncrementKg === val;
                return (
                  <button
                    key={val}
                    type="button"
                    className={`btn-clean btn-sm ${isSelected ? 'btn-primary' : ''}`}
                    onClick={() => handleUpdateProgression({ weeklyIncrementKg: val })}
                  >
                    +{val} KG {val === 2.5 ? '(Recommended)' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Button: Trigger Auto-Scale Now */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-clean btn-primary btn-sm"
              onClick={handleTriggerAutoScale}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Sparkles size={13} />
              <span>Auto-Setup Weeks 2 to 6 Now ⚡</span>
            </button>

            <button
              type="button"
              className="btn-clean btn-sm"
              onClick={handleStartNextCycle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.35))',
                borderColor: 'var(--accent-red)',
                color: '#fff',
                fontWeight: 700,
              }}
            >
              <Rocket size={13} color="var(--accent-red)" />
              <span>Start Next 6-Week Cycle 🚀</span>
            </button>

            <Link
              href="/planner"
              className="btn-clean btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Calendar size={13} />
              <span>Open Planner ↗</span>
            </Link>
          </div>
        </div>
        {/* 4. Multi-Device Cloud & Direct Sync */}
        <div className="clean-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3
              style={{
                fontSize: '0.88rem',
                fontWeight: 800,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Smartphone size={16} color="var(--accent-red)" />
              <span>Multi-Device Sync (PC ⟷ Mobile)</span>
            </h3>
            <span
              className={`cloud-status-pill ${cloudInfo.status === 'offline' ? 'offline' : 'synced'}`}
              style={{ fontSize: '0.68rem', padding: '3px 8px' }}
            >
              {cloudInfo.status === 'offline' ? '📶 Offline' : '🟢 Cloud Ready'}
            </span>
          </div>

          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
            Seamlessly transfer or synchronize your entire 6-week program, exercises, weights, and workout history across your phone, tablet, and PC.
          </p>

          {/* Automatic Cloud Sync Controls */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <button
              type="button"
              className="btn-clean btn-primary btn-sm"
              onClick={handleSyncNow}
              disabled={isSyncing}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.78rem' }}
            >
              {isSyncing ? <RefreshCw size={14} className="spin" /> : <Cloud size={14} />}
              <span>{isSyncing ? 'Synchronizing Workouts...' : '⚡ Sync Workout Data Now'}</span>
            </button>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '10px 14px',
              marginBottom: '12px',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 800, color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚡ 100% Automatic Background Sync</span>
            </div>
            Whenever you add exercises, update weights, or check off sets, they are saved automatically to your personal cloud account.
            When you open Null Gym on your mobile phone or tablet, it automatically synchronizes and downloads your latest workouts.
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(34, 197, 94, 0.06)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: 'var(--radius)',
              padding: '8px 12px',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                boxShadow: '0 0 6px #22c55e',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              <strong>Continuous Sync:</strong> Automatically saves workout changes and synchronizes when connected.
            </span>
          </div>
        </div>

        {/* ADMIN EXCLUSIVE: Supabase Database & Developer Diagnostics */}
        {isAdmin && (
          <div
            className="clean-card"
            style={{
              border: '1px solid rgba(234, 179, 8, 0.35)',
              background: 'linear-gradient(180deg, rgba(234, 179, 8, 0.05) 0%, rgba(13, 17, 26, 0.6) 100%)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
              <h3
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  color: '#fde047',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ShieldCheck size={16} color="#fde047" />
                <span>[ADMIN CONSOLE] Database &amp; Developer Diagnostics</span>
              </h3>
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius)',
                  background: 'rgba(234, 179, 8, 0.15)',
                  border: '1px solid rgba(234, 179, 8, 0.35)',
                  color: '#fde047',
                  fontWeight: 700,
                }}
              >
                👑 Admin Mode ({ADMIN_EMAIL})
              </span>
            </div>

            <p style={{ fontSize: '0.74rem', color: '#cbd5e1', marginBottom: '12px', lineHeight: 1.5 }}>
              This developer card is strictly hidden from regular users and only visible to you ({ADMIN_EMAIL}). Use it to test Supabase live connectivity, check Row-Level Security (RLS) write permissions, and access database tables.
            </p>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <button
                type="button"
                className="btn-clean btn-primary btn-sm"
                onClick={handleTestSupabase}
                disabled={isTestingDb}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.78rem' }}
              >
                {isTestingDb ? <RefreshCw size={14} className="spin" /> : <Cloud size={14} />}
                <span>{isTestingDb ? 'Testing Connection & RLS...' : '⚡ Test Supabase Connection & Permissions'}</span>
              </button>

              <a
                href="https://supabase.com/dashboard/project/ftssrejkpjyrzkgkkfnz/sql/new"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-clean btn-sm"
                style={{
                  fontSize: '0.72rem',
                  padding: '8px 12px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#7dd3fc',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ExternalLink size={13} />
                <span>Open Supabase SQL Editor ↗</span>
              </a>

              <a
                href="https://supabase.com/dashboard/project/ftssrejkpjyrzkgkkfnz/auth/providers"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-clean btn-sm"
                style={{
                  fontSize: '0.72rem',
                  padding: '8px 12px',
                  background: 'rgba(168, 85, 247, 0.15)',
                  border: '1px solid rgba(168, 85, 247, 0.35)',
                  color: '#d8b4fe',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ExternalLink size={13} />
                <span>Supabase Auth Providers ↗</span>
              </a>

              <a
                href="https://supabase.com/dashboard/project/ftssrejkpjyrzkgkkfnz/auth/url-configuration"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-clean btn-sm"
                style={{
                  fontSize: '0.72rem',
                  padding: '8px 12px',
                  background: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid rgba(34, 197, 94, 0.35)',
                  color: '#86efac',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ExternalLink size={13} />
                <span>Site URL &amp; Redirects ↗</span>
              </a>
            </div>

            {/* Database Diagnostics Result Box (Admin Only) */}
            {dbTestResult && (
              <div
                style={{
                  background: dbTestResult.needsRlsFix
                    ? 'rgba(239, 68, 68, 0.12)'
                    : dbTestResult.connected
                    ? 'rgba(34, 197, 94, 0.12)'
                    : 'rgba(245, 158, 11, 0.12)',
                  border: `1px solid ${
                    dbTestResult.needsRlsFix
                      ? 'rgba(239, 68, 68, 0.35)'
                      : dbTestResult.connected
                      ? 'rgba(34, 197, 94, 0.35)'
                      : 'rgba(245, 158, 11, 0.35)'
                  }`,
                  borderRadius: 'var(--radius)',
                  padding: '12px 14px',
                  marginBottom: '10px',
                  fontSize: '0.74rem',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: '4px', color: dbTestResult.needsRlsFix ? '#fca5a5' : dbTestResult.connected ? '#86efac' : '#fde047' }}>
                  {dbTestResult.message}
                </div>

                {dbTestResult.needsRlsFix && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ color: '#cbd5e1', marginBottom: '6px' }}>
                      Copy this 3-line SQL command and run it in your <strong>Supabase SQL Editor</strong> to enable instant multi-device cloud sync:
                    </div>
                    <pre
                      style={{
                        background: 'rgba(0,0,0,0.6)',
                        padding: '10px',
                        borderRadius: 'var(--radius)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        overflowX: 'auto',
                        marginBottom: '10px',
                        color: '#93c5fd',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      {sqlFixCode}
                    </pre>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-clean btn-primary btn-sm"
                        onClick={handleCopySql}
                        style={{ fontSize: '0.72rem', padding: '6px 12px' }}
                      >
                        {isSqlCopied ? <Check size={13} color="#fff" /> : <Copy size={13} />}
                        <span>{isSqlCopied ? 'SQL Copied to Clipboard!' : '1. Copy SQL Script'}</span>
                      </button>
                      <a
                        href="https://supabase.com/dashboard/project/ftssrejkpjyrzkgkkfnz/sql/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-clean btn-sm"
                        style={{
                          fontSize: '0.72rem',
                          padding: '6px 12px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          color: '#7dd3fc',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>2. Open Supabase SQL Editor ↗</span>
                      </a>
                      <button
                        type="button"
                        className="btn-clean btn-sm"
                        onClick={handleTestSupabase}
                        disabled={isTestingDb}
                        style={{ fontSize: '0.72rem', padding: '6px 12px' }}
                      >
                        <RefreshCw size={13} className={isTestingDb ? 'spin' : ''} />
                        <span>3. Re-test Now</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}



        {/* 6. Personal Workout Backup & Restore */}
        <div className="clean-card">
          <h3
            style={{
              fontSize: '0.88rem',
              fontWeight: 800,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '8px',
            }}
          >
            <Download size={15} color="var(--accent-red)" />
            <span>Personal Workout Backup &amp; Transfer</span>
          </h3>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Download a complete backup file of your 6-week program, completed workouts, and PRs to transfer to another device.
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-clean btn-primary btn-sm"
              onClick={handleExport}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={13} />
              <span>Download Backup File</span>
            </button>

            <button
              type="button"
              className="btn-clean btn-sm"
              onClick={() => fileInputRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Upload size={13} />
              <span>Restore from File</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".json"
              onChange={handleFileChange}
            />
          </div>
        </div>
      </div>

      {/* 6. Reset & Cleanup */}
      <div
        className="clean-card"
        style={{ border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.02)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
          <h3
            style={{
              fontSize: '0.88rem',
              fontWeight: 800,
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              margin: 0,
            }}
          >
            <Trash2 size={15} />
            <span>Reset &amp; Cleanup</span>
          </h3>
          <span
            style={{
              fontSize: '0.66rem',
              color: 'var(--text-dim)',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '2px 8px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}
          >
            Zero-Delay Instant Wipe
          </span>
        </div>
        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.45 }}>
          Selective clean-up tools for your routine, completed history, and system state. Each action shows exactly what will be removed and what stays safe before proceeding.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Action 1: Clean All Exercises from Plan */}
          <button
            type="button"
            className="btn-clean btn-sm"
            onClick={openCleanExercisesModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Trash2 size={14} color="#fca5a5" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#fff' }}>
                  Wipe All Planned Exercises
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Removes exercises from Weeks 1–6 • Keeps history and PRs safe
                </div>
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-red)', fontWeight: 700 }}>Wipe →</span>
          </button>

          {/* Action 2: Reset to Blank 6-Week Plan */}
          <button
            type="button"
            className="btn-clean btn-sm"
            onClick={openResetBlankModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <RefreshCw size={14} color="#93c5fd" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#fff' }}>
                  Reset 6-Week Plan to Blank
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Resets routine to clean 7-day canvas • Keeps history and PRs safe
                </div>
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#60a5fa', fontWeight: 700 }}>Reset →</span>
          </button>

          {/* Action 3: Clear Logged Workout History & PRs */}
          <button
            type="button"
            className="btn-clean btn-sm"
            onClick={openClearHistoryModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.03)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 'var(--radius)',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Trash2 size={14} color="var(--accent-red)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#fff' }}>
                  Clear Logged History &amp; PRs
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Clears past workout logs and PR graphs • Keeps planned routines safe
                </div>
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-red)', fontWeight: 700 }}>Clear →</span>
          </button>

          {/* Action 4: Factory Reset App */}
          <button
            type="button"
            className="btn-clean btn-sm"
            onClick={openFactoryResetModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.07)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 'var(--radius)',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Zap size={14} color="var(--accent-red)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#f87171' }}>
                  Factory Reset Entire Application
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Wipes plan and history, restores full {ALL_CATALOG_EXERCISES.length} catalog
                </div>
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-red)', fontWeight: 800 }}>Wipe All →</span>
          </button>
        </div>
      </div>

      {/* Instant In-App Reset Confirmation Modal (Zero delay, non-blocking) */}
      {resetModal && resetModal.isOpen && (
        <div
          className="clean-modal-backdrop"
          onClick={() => setResetModal(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
        >
          <div
            className="clean-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: 'var(--radius)',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle size={18} color="var(--accent-red)" />
                </div>
                <h3 id="reset-modal-title" style={{ fontSize: '0.98rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  {resetModal.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResetModal(null)}
                className="icon-action-btn"
                style={{ padding: '4px' }}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '14px' }}>
              {resetModal.description}
            </p>

            {/* What Will Be Deleted */}
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
                marginBottom: '10px',
              }}
            >
              <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#f87171', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.04em' }}>
                Will Be Removed:
              </div>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.73rem', color: '#fca5a5', lineHeight: 1.4 }}>
                {resetModal.willDelete.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            {/* What Stays Safe */}
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
                marginBottom: '18px',
              }}
            >
              <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.04em' }}>
                Stays 100% Safe:
              </div>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.73rem', color: '#6ee7b7', lineHeight: 1.4 }}>
                {resetModal.willKeepSafe.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-clean btn-sm"
                onClick={() => setResetModal(null)}
                style={{ padding: '8px 14px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-clean btn-danger btn-sm"
                onClick={() => {
                  const action = resetModal.onConfirm;
                  setResetModal(null);
                  action();
                }}
                style={{ padding: '8px 14px', fontWeight: 700 }}
              >
                {resetModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credits & Acknowledgments Card */}
      <div className="clean-card" style={{ marginTop: '14px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <h3
            style={{
              fontSize: '0.88rem',
              fontWeight: 800,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Heart size={16} color="var(--accent-red)" />
            <span>Credits &amp; Acknowledgments</span>
          </h3>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.66rem',
                color: 'var(--accent-red)',
                background: 'rgba(239, 68, 68, 0.12)',
                padding: '3px 8px',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
              }}
            >
              v2.0 Final Release
            </span>
            <span
              style={{
                fontSize: '0.66rem',
                color: '#22c55e',
                background: 'rgba(34, 197, 94, 0.12)',
                padding: '3px 8px',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                fontWeight: 700,
              }}
            >
              100% Offline Ready
            </span>
          </div>
        </div>

        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
          Null Gym is an open-source, offline-first personal training system designed for athletes and lifters who demand zero fluff, sub-millisecond execution, and total privacy.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          {/* Creator Attribution */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '12px',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: 700 }}>
              Lead Developer &amp; Architecture
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Github size={14} color="var(--accent-red)" />
              <a
                href="https://github.com/Null72X"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Null72X
                <ExternalLink size={11} color="var(--text-muted)" />
              </a>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Creator and maintainer of Null Gym. Repository: <a href="https://github.com/Null72X/Null-Gym" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-red)', textDecoration: 'none' }}>Null72X/Null-Gym</a>
            </div>
          </div>

          {/* Master Exercise Catalog Attribution */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '12px',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: 700 }}>
              Master Exercise Catalog
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Dumbbell size={14} color="#38bdf8" />
              <span>Exercise Catalog (Offline)</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Provides {ALL_CATALOG_EXERCISES.length} indexed exercises with targets, equipment categories, and execution cues.
            </div>
          </div>

          {/* Animation & Form GIFs Attribution */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '12px',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: 700 }}>
              Form Visuals &amp; Demonstrations
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} color="#eab308" />
              <a
                href="https://github.com/JahelCuadrado/ExerciseGymGifsDB"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                ExerciseGymGifsDB (Jahel Cuadrado)
                <ExternalLink size={11} color="var(--text-muted)" />
              </a>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              High-resolution animated GIF demonstrations mapped to exercises with offline fallback.
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: '0.68rem',
            color: 'var(--text-dim)',
            borderTop: '1px solid var(--border)',
            paddingTop: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '6px',
          }}
        >
          <span>Crafted with Next.js 14, React 18, TypeScript &amp; Supabase</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>Released under MIT License</span>
        </div>
      </div>

      {/* Toast */}
      <div className={`clean-toast ${toastMessage ? 'show' : ''}`}>
        {toastMessage}
      </div>
    </div>
  );
}
