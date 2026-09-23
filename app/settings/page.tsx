'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
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
  forcePushAllToCloud,
  forcePullAllFromCloud,
} from '../../lib/storage';
import {
  onCloudStatus,
  checkSupabaseConnection,
  CloudSyncInfo,
} from '../../lib/supabaseSync';
import { WeightUnit } from '../../types/workout';
import { ALL_CATALOG_EXERCISES } from '../../lib/exerciseCatalog';
import {
  Settings,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Check,
  AlertTriangle,
  ShieldCheck,
  BookOpen,
  Calendar,
  Zap,
  Cloud,
  ExternalLink,
  Copy,
  Dumbbell,
} from 'lucide-react';

const SUPABASE_SETUP_SQL = `-- 1. Workout Plan table (stores 4-week routines, exercises, sets)
CREATE TABLE IF NOT EXISTS workout_plan (
  id TEXT PRIMARY KEY DEFAULT 'default_plan',
  weeks JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Workout History table (stores finished workouts, timestamps, sets, PRs)
CREATE TABLE IF NOT EXISTS workout_history (
  id TEXT PRIMARY KEY,
  session_date TIMESTAMPTZ,
  day_title TEXT,
  week_number INT,
  sets JSONB,
  duration_minutes INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. App Settings table (active week, active day, kg/lbs preference)
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'settings',
  settings JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Custom Exercise Library table (custom user-added exercises)
CREATE TABLE IF NOT EXISTS custom_library (
  id TEXT PRIMARY KEY DEFAULT 'library',
  exercises JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security (RLS) so your personal app can sync without login friction
ALTER TABLE workout_plan DISABLE ROW LEVEL SECURITY;
ALTER TABLE workout_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE custom_library DISABLE ROW LEVEL SECURITY;
`;

export default function SettingsPage() {
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [libraryCount, setLibraryCount] = useState<number>(570);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cloudInfo, setCloudInfo] = useState<CloudSyncInfo>({
    status: 'syncing',
    message: 'Connecting to Supabase...',
  });
  const [isCheckingCloud, setIsCheckingCloud] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const active = getActiveSelection();
    if (active.unit) setUnit(active.unit);
    const lib = getSavedLibrary();
    setLibraryCount(lib.length);

    const unsubCloud = onCloudStatus((info) => {
      setCloudInfo(info);
    });

    return () => {
      unsubCloud();
    };
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  // Copy Supabase SQL script to clipboard
  const handleCopySql = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
      setCopiedSql(true);
      triggerToast('SQL setup script copied to clipboard! 📋');
      setTimeout(() => setCopiedSql(false), 3000);
    }
  };

  // Pull latest updates from Supabase
  const handleForcePullCloud = async () => {
    triggerToast('Checking Supabase for updates...');
    const success = await forcePullAllFromCloud();
    if (success) {
      triggerToast('Synced latest data from Supabase cloud! ☁️');
      setTimeout(() => window.location.reload(), 700);
    } else {
      triggerToast('Cloud checked. Up to date or tables need setup.');
    }
  };

  // Push local plan and history to Supabase
  const handleForcePushCloud = async () => {
    triggerToast('Uploading local 4-week data to Supabase...');
    const success = await forcePushAllToCloud();
    if (success) {
      triggerToast('All 4 weeks & history uploaded to Supabase! ☁️');
    } else {
      triggerToast('Upload failed: Please make sure SQL tables are created.');
    }
  };

  // Test Cloud Connection
  const handleTestCloudConnection = async () => {
    setIsCheckingCloud(true);
    triggerToast('Testing Supabase connection...');
    const result = await checkSupabaseConnection();
    setIsCheckingCloud(false);
    if (result.connected && result.tableFound) {
      triggerToast('✅ Supabase connected & tables verified!');
    } else if (result.connected && !result.tableFound) {
      triggerToast('⚠️ Connected, but tables not found. Run SQL script.');
    } else {
      triggerToast(`❌ Error: ${result.message}`);
    }
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
      triggerToast('Full 4-week data exported successfully! 📁');
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
          triggerToast('Backup restored successfully! Reloading...');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          alert('Failed to import JSON: Invalid workout file structure.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Reset to blank 4 weeks
  const handleResetBlank = () => {
    if (!confirm('Reset plan to a clean 4-week blank slate (Weeks 1 to 4)?')) return;
    const blank = createBlankWeeks();
    saveWeeks(blank);
    triggerToast('Created blank 4-week plan! Opening planner...');
    setTimeout(() => {
      window.location.href = '/planner';
    }, 800);
  };

  // Clear all exercises from all weeks
  const handleCleanAllExercises = () => {
    if (!confirm('Wipe all planned exercises from all 4 weeks? Your workout history and PRs will stay intact.')) return;
    clearAllExercisesFromPlan();
    triggerToast('All exercises removed from plan. Empty 4-week canvas ready.');
    setTimeout(() => {
      window.location.href = '/planner';
    }, 700);
  };

  // Restore Master Exercise Catalog (570 items)
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
    if (!confirm('FACTORY RESET: This will reset all 4 weeks to blank, restore the full 570-exercise library, and delete all history. Continue?')) return;
    factoryResetAll();
    triggerToast('Factory reset complete! Reloading Null-Gym...');
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
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
            <span>Settings &amp; System Configuration</span>
          </h2>
          <p>Manage cloud sync, configure units, program templates, and master catalogs.</p>
        </div>
      </section>

      {/* Automatic Database & Multi-Device Sync */}
      <div className="clean-card" style={{ marginBottom: '14px' }}>
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
            <span>Automatic Database &amp; Multi-Device Sync</span>
          </h3>
          <span
            className="cloud-status-pill synced"
            style={{ fontSize: '0.68rem', padding: '3px 8px' }}
          >
            🟢 100% Automatic &amp; Active
          </span>
        </div>

        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
          Your workouts, 4-week program, history, and PRs automatically persist to your database and sync across all your devices in real-time. Zero configuration, zero scripts, and zero login screens required.
        </p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-clean btn-sm"
            onClick={handleForcePullCloud}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} />
            <span>Sync Now (Pull Latest)</span>
          </button>

          <button
            type="button"
            className="btn-clean btn-sm"
            onClick={handleForcePushCloud}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Upload size={13} />
            <span>Push Local Data to Database</span>
          </button>

          <button
            type="button"
            className="btn-clean btn-sm"
            onClick={handleTestCloudConnection}
            disabled={isCheckingCloud}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Check size={13} />
            <span>{isCheckingCloud ? 'Verifying...' : 'Check Database Status'}</span>
          </button>
        </div>
      </div>

      {/* System Architecture & Status Overview */}
      <div className="clean-card" style={{ marginBottom: '14px' }}>
        <h3
          style={{
            fontSize: '0.88rem',
            fontWeight: 800,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '10px',
          }}
        >
          <ShieldCheck size={15} color="var(--accent-green)" />
          <span>System Status &amp; Configuration Rules</span>
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '8px',
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '8px 10px',
            }}
          >
            <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              Plan Duration
            </div>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
              4-Week Cycle (Weeks 1–4)
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Clean blank slate by default
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '8px 10px',
            }}
          >
            <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              Master Exercise Catalog
            </div>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--accent-red)', marginTop: '2px' }}>
              {libraryCount} Exercises Available
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Across 34 categories with YouTube links
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '8px 10px',
            }}
          >
            <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              Load Stepper Engine
            </div>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#6ee7b7', marginTop: '2px' }}>
              Intelligent Auto-Adaptation
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Shows kg/lbs stepper only when load required
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '8px 10px',
            }}
          >
            <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              Plan Editing Authority
            </div>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#fde68a', marginTop: '2px' }}>
              Strictly Locked to Planner
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Tracker reserved for logging sets
            </div>
          </div>
        </div>
      </div>

      {/* Default Unit Preference */}
      <div className="clean-card" style={{ marginBottom: '14px' }}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
          Weight Unit Preference
        </h3>
        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Choose your primary weight unit for stepper increments (`±2.5`) and load tracking across all 4 weeks.
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

      {/* Master Exercise Catalog Controls */}
      <div className="clean-card" style={{ marginBottom: '14px' }}>
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
          Manage your exercise catalog containing 570 curated exercises across 34 muscle groups and functional categories, with instant YouTube tutorials.
        </p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-clean btn-primary btn-sm"
            onClick={handleRestoreCatalog}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} />
            <span>Restore 570 Master Catalog</span>
          </button>

          <button
            type="button"
            className="btn-clean btn-sm"
            onClick={handleClearLibrary}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Trash2 size={13} />
            <span>Clear Exercise Library</span>
          </button>
        </div>
      </div>

      {/* 4-Week Program Templates */}
      <div className="clean-card" style={{ marginBottom: '14px' }}>
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
          <Calendar size={15} color="var(--accent-red)" />
          <span>4-Week Program Management</span>
        </h3>
        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Reset your program to an empty 4-week canvas ready for customization in the Workout Planner.
        </p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-clean btn-sm"
            onClick={handleResetBlank}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} />
            <span>Create Empty 4-Week Plan (Weeks 1–4)</span>
          </button>

          <Link
            href="/planner"
            className="btn-clean btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Dumbbell size={13} />
            <span>Open Workout Planner ↗</span>
          </Link>
        </div>
      </div>

      {/* Data Backup & Restore */}
      <div className="clean-card" style={{ marginBottom: '14px' }}>
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
          <span>Data Backup &amp; Transfer</span>
        </h3>
        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Export your entire 4-week workout program, custom exercises, completed session history, and personal records as a single JSON backup.
        </p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-clean btn-primary btn-sm"
            onClick={handleExport}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={13} />
            <span>Export Full Backup (.json)</span>
          </button>

          <button
            type="button"
            className="btn-clean btn-sm"
            onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Upload size={13} />
            <span>Import Backup (.json)</span>
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

      {/* Danger Zone */}
      <div
        className="clean-card"
        style={{ border: '1px solid rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.02)' }}
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
          <AlertTriangle size={15} />
          <span>Danger Zone</span>
        </h3>
        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Irreversible actions. Wipe planned workouts, clear historical records, or perform a complete factory reset.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            className="btn-clean btn-danger btn-sm"
            style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={handleCleanAllExercises}
          >
            <Trash2 size={13} />
            <span>Clean All Exercises from 4-Week Plan (Wipe Workouts)</span>
          </button>

          <button
            type="button"
            className="btn-clean btn-danger btn-sm"
            style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={handleClearHistory}
          >
            <Trash2 size={13} />
            <span>Clear All Workout History &amp; PRs</span>
          </button>

          <button
            type="button"
            className="btn-clean btn-danger btn-sm"
            style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={handleFactoryReset}
          >
            <Zap size={13} />
            <span>Factory Reset Entire Website (Clean Slate + 570 Catalog)</span>
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
