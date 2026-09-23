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
} from '../../lib/storage';
import { onCloudStatus, CloudSyncInfo } from '../../lib/supabaseSync';
import { WeightUnit, ProgressionConfig } from '../../types/workout';
import { ALL_CATALOG_EXERCISES } from '../../lib/exerciseCatalog';
import {
  Settings,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Check,
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
} from 'lucide-react';

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubCloud = onCloudStatus((info) => {
      setCloudInfo(info);
    });

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
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
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

  // Restore Master Exercise Catalog (710+ items)
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

      {/* Settings Grid (Cards 1-6) */}
      <div className="responsive-grid-2" style={{ marginBottom: '14px' }}>
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
                Automatically calculates weekly overload across your full 6-week cycle
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
              Weekly Overload Increment (per lift)
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

        {/* 4. Multi-Device Cloud Sync */}
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
              <Cloud size={16} color="var(--accent-green)" />
              <span>Multi-Device Cloud Sync</span>
            </h3>
            <span
              className={`cloud-status-pill ${cloudInfo.status === 'offline' ? 'offline' : 'synced'}`}
              style={{ fontSize: '0.68rem', padding: '3px 8px' }}
            >
              {cloudInfo.status === 'offline' ? '📶 Offline' : '🟢 100% Automatic'}
            </span>
          </div>

          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
            Your workouts, 6-week program, history, and PRs automatically persist and sync across your phone, tablet, and PC in real time.
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: '8px',
              padding: '10px 14px',
            }}
          >
            <div
              style={{
                width: '9px',
                height: '9px',
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                boxShadow: '0 0 8px #22c55e',
                flexShrink: 0,
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4ade80' }}>
                Always-On Continuous Cloud Sync Active
              </span>
              <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Zero buttons needed. Every set check, weight modification, and program edit syncs across all your devices automatically.
              </span>
            </div>
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
            style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={handleResetBlank}
          >
            <RefreshCw size={13} />
            <span>Create Empty 6-Week Plan (Weeks 1–6)</span>
          </button>

          <button
            type="button"
            className="btn-clean btn-danger btn-sm"
            style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={handleCleanAllExercises}
          >
            <Trash2 size={13} />
            <span>Clean All Exercises from Plan</span>
          </button>

          <button
            type="button"
            className="btn-clean btn-danger btn-sm"
            style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={handleClearHistory}
          >
            <Trash2 size={13} />
            <span>Clear Logged Workout History &amp; PRs</span>
          </button>

          <button
            type="button"
            className="btn-clean btn-danger btn-sm"
            style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={handleFactoryReset}
          >
            <Zap size={13} />
            <span>Restore Default App (Blank 6-Week Plan + {ALL_CATALOG_EXERCISES.length} Catalog)</span>
          </button>
        </div>
      </div>

      {/* Toast */}
      <div className={`clean-toast ${toastMessage ? 'show' : ''}`}>
        {toastMessage}
      </div>
    </div>
  );
}
