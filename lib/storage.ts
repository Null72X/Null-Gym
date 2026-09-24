import {
  WeekPlan,
  DayWorkout,
  Exercise,
  WorkoutSet,
  ExerciseLibraryItem,
  WorkoutHistoryEntry,
  WeightUnit,
  ProgressionConfig,
} from '../types/workout';
import { ALL_CATALOG_EXERCISES } from './exerciseCatalog';
import { DEFAULT_PROGRESSION_CONFIG, autoScaleWeek1ToAllWeeks } from './progressionEngine';
import {
  debouncedPushPlanToCloud,
  pushPlanToCloud,
  pullPlanFromCloud,
  pushHistoryToCloud,
  pullHistoryFromCloud,
  debouncedPushSettingsToCloud,
  pushSettingsToCloud,
  pullSettingsFromCloud,
  notifyCloudStatus,
} from './supabaseSync';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const STORAGE_KEYS = {
  WEEKS: 'gym_weeks_v6',
  HISTORY: 'gym_history_v6',
  LIBRARY: 'gym_library_v7_exercisedb',
  ACTIVE: 'gym_active_v6',
  PROGRESSION: 'gym_progression_v6',
};

// 1,323 ExerciseDB Master exercise library with animated demonstrations & coaching cues
export const DEFAULT_LIBRARY: ExerciseLibraryItem[] = ALL_CATALOG_EXERCISES;

import { createBlankWeeks, ensureSixWeeks } from './planDefaults';
export { createBlankWeeks, ensureSixWeeks };

// In-Memory Fast Cache Layer (0ms access on route switching & updates)
let cachedWeeks: WeekPlan[] | null = null;
let cachedHistory: WorkoutHistoryEntry[] | null = null;
let cachedLibrary: ExerciseLibraryItem[] | null = null;
let cachedActive: { weekNumber: number; dayIndex: number; unit: WeightUnit } | null = null;
let cachedProgression: ProgressionConfig | null = null;
let lastLocalEditTimestamp = 0;

export function getLastLocalEditTimestamp() {
  return lastLocalEditTimestamp;
}

// Event bus for autosave status
type SaveStatus = 'saved' | 'saving';
type SaveListener = (status: SaveStatus) => void;
const saveListeners: Set<SaveListener> = new Set();

export function onSaveStatus(listener: SaveListener) {
  saveListeners.add(listener);
  return () => {
    saveListeners.delete(listener);
  };
}

let saveTimer: any = null;
function emitSave(status: SaveStatus) {
  saveListeners.forEach((l) => l(status));
}

// Event bus for cloud plan updates
type CloudPlanListener = (weeks: WeekPlan[]) => void;
const planListeners: Set<CloudPlanListener> = new Set();

export function onCloudPlanUpdated(listener: CloudPlanListener) {
  planListeners.add(listener);
  return () => {
    planListeners.delete(listener);
  };
}

// Event bus for cloud history updates
type CloudHistoryListener = (history: WorkoutHistoryEntry[]) => void;
const historyListeners: Set<CloudHistoryListener> = new Set();

export function onCloudHistoryUpdated(listener: CloudHistoryListener) {
  historyListeners.add(listener);
  return () => {
    historyListeners.delete(listener);
  };
}

// Event bus for active selection / settings updates
type CloudSettingsListener = (settings: { weekNumber: number; dayIndex: number; unit: WeightUnit }) => void;
const settingsListeners: Set<CloudSettingsListener> = new Set();

export function onCloudSettingsUpdated(listener: CloudSettingsListener) {
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
}

// Instant cross-tab sync channel
let crossTabChannel: any = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    crossTabChannel = new BroadcastChannel('null_gym_cross_tab_sync');
    crossTabChannel.onmessage = (event: any) => {
      const { type, data } = event.data || {};
      if (type === 'plan' && Array.isArray(data)) {
        cachedWeeks = data;
        planListeners.forEach((l) => l(data));
      } else if (type === 'history' && Array.isArray(data)) {
        cachedHistory = data;
        historyListeners.forEach((l) => l(data));
      } else if (type === 'settings' && data) {
        cachedActive = data;
        settingsListeners.forEach((l) => l(data));
      }
    };
  } catch {}
}

// STORAGE ACCESSORS WITH IN-MEMORY INSTANT CACHE
export function getSavedWeeks(): WeekPlan[] {
  if (cachedWeeks !== null) return cachedWeeks;
  if (typeof window === 'undefined') return createBlankWeeks();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WEEKS);
    if (!raw) {
      const initial = createBlankWeeks();
      cachedWeeks = initial;
      localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    const valid = ensureSixWeeks(parsed);
    cachedWeeks = valid;
    return valid;
  } catch (err) {
    console.error('Failed to load weeks from storage', err);
    const blank = createBlankWeeks();
    cachedWeeks = blank;
    return blank;
  }
}

// Clean / wipe all exercises from all weeks and days
export function clearAllExercisesFromPlan(): WeekPlan[] {
  const blank = createBlankWeeks();
  saveWeeks(blank);
  saveHistory([]);
  return blank;
}

export function saveWeeks(weeks: WeekPlan[]) {
  const verifiedWeeks = ensureSixWeeks(weeks);
  cachedWeeks = verifiedWeeks;
  lastLocalEditTimestamp = Date.now();
  if (typeof window === 'undefined') return;

  emitSave('saving');
  try {
    localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(verifiedWeeks));
    crossTabChannel?.postMessage({ type: 'plan', data: verifiedWeeks });
    debouncedPushPlanToCloud(verifiedWeeks);
    emitSave('saved');
  } catch (err) {
    console.error('Failed to save weeks', err);
  }
}

export function getSavedLibrary(): ExerciseLibraryItem[] {
  if (cachedLibrary !== null) return cachedLibrary;
  if (typeof window === 'undefined') return DEFAULT_LIBRARY;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LIBRARY);
    if (!raw) {
      cachedLibrary = DEFAULT_LIBRARY;
      localStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(DEFAULT_LIBRARY));
      return DEFAULT_LIBRARY;
    }
    const saved = JSON.parse(raw);
    // Auto-upgrade if cached library is old (less than 1000 items or missing exdb IDs)
    const isOldLibrary = Array.isArray(saved) && (saved.length < 1000 || !saved.some((e: any) => e.id?.startsWith('exdb_')));
    if (isOldLibrary) {
      cachedLibrary = DEFAULT_LIBRARY;
      localStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(DEFAULT_LIBRARY));
      return DEFAULT_LIBRARY;
    }
    if (Array.isArray(saved) && saved.length > 0) {
      cachedLibrary = saved;
      return saved;
    }
    cachedLibrary = DEFAULT_LIBRARY;
    return DEFAULT_LIBRARY;
  } catch (err) {
    cachedLibrary = DEFAULT_LIBRARY;
    return DEFAULT_LIBRARY;
  }
}

export function saveLibrary(library: ExerciseLibraryItem[]) {
  cachedLibrary = library;
  if (typeof window === 'undefined') return;
  emitSave('saving');
  try {
    localStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(library));
    emitSave('saved');
  } catch (err) {
    console.error('Failed to save library', err);
  }
}

export function getSavedHistory(): WorkoutHistoryEntry[] {
  if (cachedHistory !== null) return cachedHistory;
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (!raw) {
      cachedHistory = [];
      return [];
    }
    const parsed = JSON.parse(raw);
    cachedHistory = parsed;
    return parsed;
  } catch (err) {
    cachedHistory = [];
    return [];
  }
}

export function saveHistory(history: WorkoutHistoryEntry[]) {
  cachedHistory = history;
  lastLocalEditTimestamp = Date.now();
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    crossTabChannel?.postMessage({ type: 'history', data: history });
    pushHistoryToCloud(history);
  } catch (err) {
    console.error('Failed to save history', err);
  }
}

export function getActiveSelection(): { weekNumber: number; dayIndex: number; unit: WeightUnit } {
  if (cachedActive !== null) return cachedActive;
  if (typeof window === 'undefined') return { weekNumber: 1, dayIndex: 0, unit: 'kg' };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE);
    if (!raw) {
      const def = { weekNumber: 1, dayIndex: 0, unit: 'kg' as WeightUnit };
      cachedActive = def;
      return def;
    }
    const parsed = JSON.parse(raw);
    const weekNumber = Math.min(6, Math.max(1, parsed.weekNumber || 1));
    const dayIndex = Math.min(6, Math.max(0, parsed.dayIndex || 0));
    const active = { weekNumber, dayIndex, unit: parsed.unit || 'kg' };
    cachedActive = active;
    return active;
  } catch (err) {
    const def = { weekNumber: 1, dayIndex: 0, unit: 'kg' as WeightUnit };
    cachedActive = def;
    return def;
  }
}

export function saveActiveSelection(active: {
  weekNumber: number;
  dayIndex: number;
  unit: WeightUnit;
}) {
  cachedActive = active;
  lastLocalEditTimestamp = Date.now();
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE, JSON.stringify(active));
    crossTabChannel?.postMessage({ type: 'settings', data: active });
    debouncedPushSettingsToCloud(active);
  } catch (err) {
    console.error('Failed to save active selection', err);
  }
}

export function getProgressionConfig(): ProgressionConfig {
  if (cachedProgression !== null) return cachedProgression;
  if (typeof window === 'undefined') return DEFAULT_PROGRESSION_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROGRESSION);
    if (!raw) {
      cachedProgression = DEFAULT_PROGRESSION_CONFIG;
      return DEFAULT_PROGRESSION_CONFIG;
    }
    const parsed = { ...DEFAULT_PROGRESSION_CONFIG, ...JSON.parse(raw) };
    cachedProgression = parsed;
    return parsed;
  } catch {
    cachedProgression = DEFAULT_PROGRESSION_CONFIG;
    return DEFAULT_PROGRESSION_CONFIG;
  }
}

export function saveProgressionConfig(config: ProgressionConfig) {
  cachedProgression = config;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.PROGRESSION, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save progression config', err);
  }
}

export function applyAutoScaleToAllWeeks(): WeekPlan[] {
  const currentWeeks = getSavedWeeks();
  const config = getProgressionConfig();
  const active = getActiveSelection();
  const scaled = autoScaleWeek1ToAllWeeks(currentWeeks, config, active.unit);
  saveWeeks(scaled);
  return scaled;
}

// -------------------------------------------------------------
// ALWAYS-ON CONTINUOUS BACKGROUND MULTI-DEVICE SYNC ENGINE
// -------------------------------------------------------------
let isSyncInitialized = false;
let lastSyncedServerTimestamp: string | null = null;
let isAutoSyncRunning = false;

export async function performContinuousCloudSync(force = false) {
  if (typeof window === 'undefined' || isAutoSyncRunning) return;

  // Protect local changes: if the user recently edited anything locally (< 8s ago), do not pull and overwrite!
  if (!force && Date.now() - lastLocalEditTimestamp < 8000) {
    return;
  }

  isAutoSyncRunning = true;

  try {
    const res = await fetch('/api/sync', { cache: 'no-store' });
    if (!res.ok) {
      isAutoSyncRunning = false;
      return;
    }

    const body = await res.json();
    if (!body || !body.success) {
      isAutoSyncRunning = false;
      return;
    }

    const serverTime = body.updatedAt;
    const localRawWeeks = localStorage.getItem(STORAGE_KEYS.WEEKS);
    const localWeeks = localRawWeeks ? JSON.parse(localRawWeeks) : null;
    const localHasExercises =
      localWeeks &&
      Array.isArray(localWeeks) &&
      localWeeks.some((w: any) => w.days.some((d: any) => d.exercises?.length > 0));

    // Case 1: First-time seed - Server database is empty, but local has user workouts
    if (!body.plan && localHasExercises) {
      const active = getActiveSelection();
      const hist = getSavedHistory();
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_all',
          data: { plan: localWeeks, history: hist, settings: active },
        }),
      });
      lastSyncedServerTimestamp = new Date().toISOString();
      notifyCloudStatus('synced', 'Database Synced');
      isAutoSyncRunning = false;
      return;
    }

    // Case 2: Server has plan data -> sync smoothly to local device
    if (body.plan && Array.isArray(body.plan) && body.plan.length > 0) {
      if (force || serverTime !== lastSyncedServerTimestamp) {
        lastSyncedServerTimestamp = serverTime;

        // Upgrade server plans to 6-week if needed
        const validServerWeeks = ensureSixWeeks(body.plan);

        const serverWeeksStr = JSON.stringify(validServerWeeks);
        if (localRawWeeks !== serverWeeksStr) {
          cachedWeeks = validServerWeeks;
          localStorage.setItem(STORAGE_KEYS.WEEKS, serverWeeksStr);
          planListeners.forEach((l) => l(validServerWeeks));
        }

        // Sync history
        if (Array.isArray(body.history)) {
          const localHistRaw = localStorage.getItem(STORAGE_KEYS.HISTORY);
          const serverHistStr = JSON.stringify(body.history);
          if (localHistRaw !== serverHistStr) {
            cachedHistory = body.history;
            localStorage.setItem(STORAGE_KEYS.HISTORY, serverHistStr);
            historyListeners.forEach((l) => l(body.history));
          }
        }

        // Sync settings
        if (body.settings && typeof body.settings === 'object') {
          const localActiveRaw = localStorage.getItem(STORAGE_KEYS.ACTIVE);
          const serverSettingsStr = JSON.stringify(body.settings);
          if (localActiveRaw !== serverSettingsStr) {
            cachedActive = body.settings;
            localStorage.setItem(STORAGE_KEYS.ACTIVE, serverSettingsStr);
            settingsListeners.forEach((l) => l(body.settings));
          }
        }

        notifyCloudStatus('synced', 'Database Synced');
      }
    }
  } catch (err) {
    // Offline or network hiccup - silent retry
  } finally {
    isAutoSyncRunning = false;
  }
}

export function initBackgroundCloudSync() {
  if (typeof window === 'undefined' || isSyncInitialized) return;
  isSyncInitialized = true;

  // 1. Initial immediate sync on mount
  performContinuousCloudSync(true);

  // 2. Instant sync when user unlocks phone, returns to app, or focuses window
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      performContinuousCloudSync(false);
    }
  });

  window.addEventListener('focus', () => {
    performContinuousCloudSync(false);
  });

  window.addEventListener('online', () => {
    performContinuousCloudSync(true);
  });

  // 3. Continuous automatic heartbeat check every 15 seconds
  setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      performContinuousCloudSync(false);
    }
  }, 15000);

  // 4. Supabase Realtime channel subscription (instant multi-device push)
  if (isSupabaseConfigured && supabase) {
    try {
      supabase
        .channel('public:workout_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'workout_plan' },
          () => {
            performContinuousCloudSync(true);
          }
        )
        .subscribe();
    } catch {}
  }
}

// -------------------------------------------------------------
// BACKGROUND CLOUD SYNC ACTIONS (PROGRAMMATIC ONLY - ZERO BUTTONS)
// -------------------------------------------------------------
export async function forcePushAllToCloud(): Promise<boolean> {
  const weeks = getSavedWeeks();
  const history = getSavedHistory();
  const active = getActiveSelection();

  const planOk = await pushPlanToCloud(weeks);
  await pushHistoryToCloud(history);
  await pushSettingsToCloud(active);
  return planOk;
}

export async function forcePullAllFromCloud(): Promise<boolean> {
  await performContinuousCloudSync(true);
  return true;
}

// JSON EXPORT & IMPORT
export function exportAllData(): string {
  const data = {
    version: '3.0',
    exportDate: new Date().toISOString(),
    weeks: getSavedWeeks(),
    library: getSavedLibrary(),
    history: getSavedHistory(),
    activeSelection: getActiveSelection(),
  };
  return JSON.stringify(data, null, 2);
}

export function importAllData(jsonStr: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || !Array.isArray(parsed.weeks)) {
      throw new Error('Invalid workout data format.');
    }
    if (typeof window !== 'undefined') {
      cachedWeeks = parsed.weeks;
      localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(parsed.weeks));
      if (Array.isArray(parsed.library)) {
        cachedLibrary = parsed.library;
        localStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(parsed.library));
      }
      if (Array.isArray(parsed.history)) {
        cachedHistory = parsed.history;
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(parsed.history));
      }
      if (parsed.activeSelection) {
        cachedActive = parsed.activeSelection;
        localStorage.setItem(STORAGE_KEYS.ACTIVE, JSON.stringify(parsed.activeSelection));
      }
      emitSave('saved');
      debouncedPushPlanToCloud(parsed.weeks);
    }
    return true;
  } catch (err) {
    console.error('Import failed:', err);
    return false;
  }
}

export function restoreDefaultLibrary(): ExerciseLibraryItem[] {
  saveLibrary(DEFAULT_LIBRARY);
  return DEFAULT_LIBRARY;
}

export function factoryResetAll(): void {
  const blank = createBlankWeeks();
  saveWeeks(blank);
  saveLibrary(DEFAULT_LIBRARY);
  saveHistory([]);
  saveActiveSelection({ weekNumber: 1, dayIndex: 0, unit: 'kg' });
}
