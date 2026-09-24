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
  redeemDeviceSyncCode,
} from '../../lib/storage';
import { onCloudStatus, CloudSyncInfo, checkSupabaseConnection } from '../../lib/supabaseSync';
import DeviceSyncModal from '../../components/DeviceSyncModal';
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
} from 'lucide-react';
import {
  isAppOffline,
  isForcedOffline,
  setForcedOffline,
  onOfflineChange,
  clearOfflineCache,
  getOfflineCacheStats,
} from '../../lib/offlineManager';

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

  // Device sync & DB diagnostic states
  const [isDeviceSyncModalOpen, setIsDeviceSyncModalOpen] = useState<boolean>(false);
  const [syncCodeInput, setSyncCodeInput] = useState<string>('');
  const [isSyncingCode, setIsSyncingCode] = useState<boolean>(false);
  const [dbTestResult, setDbTestResult] = useState<{
    tested: boolean;
    connected: boolean;
    needsRlsFix: boolean;
    message: string;
  } | null>(null);
  const [isTestingDb, setIsTestingDb] = useState<boolean>(false);
  const [isSqlCopied, setIsSqlCopied] = useState<boolean>(false);

  useEffect(() => {
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

  // Redeem 6-digit sync code in settings
  const handleRedeemSettingsCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = syncCodeInput.trim().replace(/\s+/g, '');
    if (!clean) return;
    setIsSyncingCode(true);
    try {
      const res = await redeemDeviceSyncCode(clean);
      if (res.success) {
        triggerToast('🎉 Workouts successfully synced to this device!');
        setSyncCodeInput('');
        router.push('/');
      } else {
        alert(res.error || 'Invalid or expired code.');
      }
    } catch (err: any) {
      alert(err?.message || 'Sync failed.');
    } finally {
      setIsSyncingCode(false);
    }
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
    } finally {
      setIsTestingDb(false);
    }
  };

  const sqlFixCode = `-- Run once in Supabase SQL Editor (takes 5 seconds)
ALTER TABLE public.workout_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on workout_plan" ON public.workout_plan FOR ALL TO anon USING (true) WITH CHECK (true);
ALTER TABLE public.workout_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on workout_history" ON public.workout_history FOR ALL TO anon USING (true) WITH CHECK (true);`;

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

  // Reset to blank 6 weeks
  const handleResetBlank = () => {
    if (!confirm('Reset plan to a clean 6-week blank slate (Weeks 1 to 6)?')) return;
    const blank = createBlankWeeks();
    saveWeeks(blank);
    triggerToast('Created blank 6-week plan!');
    router.push('/planner');
  };

  // Clear all exercises from all weeks
  const handleCleanAllExercises = () => {
    if (!confirm('Wipe all planned exercises from all 6 weeks? Your workout history and PRs will stay intact.')) return;
    clearAllExercisesFromPlan();
    triggerToast('All exercises removed from plan.');
    router.push('/planner');
  };

  // Restore Master Exercise Catalog (1,323 items)
  const handleRestoreCatalog = () => {
    if (!confirm(`Restore the Master Exercise Library to all ${ALL_CATALOG_EXERCISES.length} default exercises with YouTube tutorials?`)) return;
    const restored = restoreDefaultLibrary();
    setLibraryCount(restored.length);
    triggerToast(`Restored all ${restored.length} master exercises to library!`);
  };

  // Clear Master Exercise Library
  const handleClearLibrary = () => {
    if (!confirm('Clear all exercises from the Exercise Library? You can re-restore them anytime.')) return;
    saveLibrary([]);
    setLibraryCount(0);
    triggerToast('Exercise library cleared');
  };

  // Clear all workout history
  const handleClearHistory = () => {
    if (!confirm('Delete ALL logged workout history and personal records? This cannot be undone.')) return;
    saveHistory([]);
    triggerToast('Workout history and PRs cleared');
  };

  // Factory Reset Website
  const handleFactoryReset = () => {
    if (!confirm(`FACTORY RESET: This will reset all 6 weeks to blank, restore the full ${ALL_CATALOG_EXERCISES.length}-exercise library, and delete all history. Continue?`)) return;
    factoryResetAll();
    triggerToast('Reset complete!');
    router.push('/');
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
              borderRadius: '8px',
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
              borderRadius: '8px',
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
                borderRadius: '8px',
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
              borderRadius: '8px',
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
              {(unit === 'kg' ? [1.25, 2.5, 5] : [2.5, 5, 10]).map((val) => {
                const isSelected =
                  unit === 'kg'
                    ? progressionConfig.weeklyIncrementKg === val
                    : progressionConfig.weeklyIncrementLbs === val;
                return (
                  <button
                    key={val}
                    type="button"
                    className={`btn-clean btn-sm ${isSelected ? 'btn-primary' : ''}`}
                    onClick={() =>
                      handleUpdateProgression(
                        unit === 'kg'
                          ? { weeklyIncrementKg: val }
                          : { weeklyIncrementLbs: val }
                      )
                    }
                  >
                    +{val} {unit.toUpperCase()} {val === (unit === 'kg' ? 2.5 : 5) ? '(Recommended)' : ''}
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

        {/* 3. Weight Unit Preference */}
        <div className="clean-card">
          <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
            Weight Unit Preference
          </h3>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Primary unit for load tracking and stepper increments across all 6 weeks.
          </p>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={`btn-clean ${unit === 'kg' ? 'btn-primary' : ''}`}
              onClick={() => handleUnitChange('kg')}
            >
              KG (Kilograms)
            </button>
            <button
              type="button"
              className={`btn-clean ${unit === 'lbs' ? 'btn-primary' : ''}`}
              onClick={() => handleUnitChange('lbs')}
            >
              LBS (Pounds)
            </button>
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

          {/* 1-Tap QR Code & Direct Transfer Button */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <button
              type="button"
              className="btn-clean btn-primary btn-sm"
              onClick={() => setIsDeviceSyncModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.78rem' }}
            >
              <Smartphone size={14} />
              <span>📱 Open QR Code &amp; Sync to Phone</span>
            </button>

            <button
              type="button"
              className="btn-clean btn-sm"
              onClick={handleTestSupabase}
              disabled={isTestingDb}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem' }}
            >
              {isTestingDb ? <RefreshCw size={13} className="spin" /> : <Cloud size={13} />}
              <span>{isTestingDb ? 'Testing Connection...' : 'Test Cloud Connection'}</span>
            </button>
          </div>

          {/* Direct 6-Digit PIN Redemption Form */}
          <form
            onSubmit={handleRedeemSettingsCode}
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '10px 12px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff' }}>
                Have a 6-digit Sync Code from another device?
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Enter the code generated on your PC to load your plan instantly.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="text"
                maxLength={6}
                value={syncCodeInput}
                onChange={(e) => setSyncCodeInput(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code"
                style={{
                  width: '110px',
                  padding: '6px 8px',
                  fontSize: '0.85rem',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '2px',
                  textAlign: 'center',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: '#fff',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={isSyncingCode || syncCodeInput.length < 6}
                className="btn-clean btn-sm btn-primary"
                style={{ padding: '6px 12px', fontSize: '0.74rem' }}
              >
                {isSyncingCode ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
          </form>

          {/* Database Diagnostics Result Box */}
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
                borderRadius: '8px',
                padding: '10px 12px',
                marginBottom: '10px',
                fontSize: '0.72rem',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: '4px', color: dbTestResult.needsRlsFix ? '#fca5a5' : dbTestResult.connected ? '#86efac' : '#fde047' }}>
                {dbTestResult.message}
              </div>

              {dbTestResult.needsRlsFix && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ color: '#cbd5e1', marginBottom: '6px' }}>
                    Copy and run this 2-line SQL command in your <strong>Supabase SQL Editor</strong> to enable public device sync:
                  </div>
                  <pre
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      padding: '8px',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.66rem',
                      overflowX: 'auto',
                      marginBottom: '8px',
                      color: '#93c5fd',
                    }}
                  >
                    {sqlFixCode}
                  </pre>
                  <button
                    type="button"
                    className="btn-clean btn-sm"
                    onClick={handleCopySql}
                    style={{ fontSize: '0.68rem', padding: '4px 10px' }}
                  >
                    {isSqlCopied ? <Check size={12} color="var(--accent-green)" /> : <Copy size={12} />}
                    <span>{isSqlCopied ? 'SQL Copied!' : 'Copy SQL Script'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(34, 197, 94, 0.06)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: '8px',
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

        {/* 5. Master Exercise Catalog */}
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
              <BookOpen size={15} color="var(--accent-red)" />
              <span>Master Exercise Library ({libraryCount} Exercises)</span>
            </h3>
            <Link
              href="/library"
              className="btn-clean btn-sm"
              style={{ fontSize: '0.7rem', padding: '3px 8px' }}
            >
              Browse Library ↗
            </Link>
          </div>

          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Curated library across the 7 Master Muscle Pillars and functional categories, with instant YouTube tutorials for each exercise.
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-clean btn-primary btn-sm"
              onClick={handleRestoreCatalog}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={13} />
              <span>Restore {ALL_CATALOG_EXERCISES.length} Master Catalog</span>
            </button>

            <button
              type="button"
              className="btn-clean btn-sm"
              onClick={handleClearLibrary}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Trash2 size={13} />
              <span>Clear Library</span>
            </button>
          </div>
        </div>

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

      {/* 7. Reset & Clean Options */}
      <div
        className="clean-card"
        style={{ border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.02)' }}
      >
        <h3
          style={{
            fontSize: '0.88rem',
            fontWeight: 800,
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '8px',
          }}
        >
          <Trash2 size={15} />
          <span>Reset &amp; Cleanup</span>
        </h3>
        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Manage your program canvas or start over with a fresh blank 6-week plan.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            className="btn-clean btn-sm"
            style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', wordBreak: 'break-word', lineHeight: 1.4 }}
            onClick={handleResetBlank}
          >
            <RefreshCw size={13} style={{ flexShrink: 0 }} />
            <span>Create Empty 6-Week Plan (Weeks 1–6)</span>
          </button>

          <button
            type="button"
            className="btn-clean btn-danger btn-sm"
            style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', wordBreak: 'break-word', lineHeight: 1.4 }}
            onClick={handleCleanAllExercises}
          >
            <Trash2 size={13} style={{ flexShrink: 0 }} />
            <span>Clean All Exercises from Plan</span>
          </button>

          <button
            type="button"
            className="btn-clean btn-danger btn-sm"
            style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', wordBreak: 'break-word', lineHeight: 1.4 }}
            onClick={handleClearHistory}
          >
            <Trash2 size={13} style={{ flexShrink: 0 }} />
            <span>Clear Logged Workout History &amp; PRs</span>
          </button>

          <button
            type="button"
            className="btn-clean btn-danger btn-sm"
            style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', wordBreak: 'break-word', lineHeight: 1.4 }}
            onClick={handleFactoryReset}
          >
            <Zap size={13} style={{ flexShrink: 0 }} />
            <span>Restore Default App (Blank 6-Week Plan + {ALL_CATALOG_EXERCISES.length} Catalog)</span>
          </button>
        </div>
      </div>

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
                borderRadius: '6px',
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
                borderRadius: '6px',
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
              borderRadius: '8px',
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
              borderRadius: '8px',
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
              borderRadius: '8px',
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

      {/* Device Sync Modal (QR Code & PIN) */}
      <DeviceSyncModal
        isOpen={isDeviceSyncModalOpen}
        onClose={() => setIsDeviceSyncModalOpen(false)}
        onSyncComplete={(msg) => {
          triggerToast(msg || 'Sync complete!');
          router.push('/');
        }}
      />

      {/* Toast */}
      <div className={`clean-toast ${toastMessage ? 'show' : ''}`}>
        {toastMessage}
      </div>
    </div>
  );
}
