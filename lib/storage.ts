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
import { DEFAULT_PROGRESSION_CONFIG, autoScaleWeek1ToAllWeeks, startNextSixWeekCycle } from './progressionEngine';
import {
  debouncedPushPlanToCloud,
  pushPlanToCloud,
  pullPlanFromCloud,
  pushHistoryToCloud,
  pullHistoryFromCloud,
  debouncedPushSettingsToCloud,
  pushSettingsToCloud,
  pullSettingsFromCloud,
  pushAllToCloud,
  pullAllFromCloud,
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
    // Auto-upgrade if cached library is old or contains outdated naming (e.g. '3 4 Sit Up', '45 Side Bend', 'Rollerout')
    const needsUpgrade =
      !Array.isArray(saved) ||
      saved.length < 1000 ||
      !saved.some((e: any) => e.id?.startsWith('exdb_')) ||
      saved.some((e: any) => e.name === '3 4 Sit Up' || e.name === '45 Side Bend' || e.name === 'Arms Overhead Full Sit Up Male' || (typeof e.name === 'string' && e.name.includes('Rollerout')));

    if (needsUpgrade) {
      // Retain any user-created custom exercises
      const customExercises = Array.isArray(saved)
        ? saved.filter((e: any) => e && e.id && !e.id.startsWith('exdb_'))
        : [];
      const upgraded = [...DEFAULT_LIBRARY, ...customExercises];
      cachedLibrary = upgraded;
      localStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(upgraded));
      return upgraded;
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

export function advanceToNextCycle(): WeekPlan[] {
  const currentWeeks = getSavedWeeks();
  const config = getProgressionConfig();
  const active = getActiveSelection();
  const newCyclePlan = startNextSixWeekCycle(currentWeeks, config, active.unit);
  saveWeeks(newCyclePlan);
  saveActiveSelection({ weekNumber: 1, dayIndex: 0, unit: active.unit });
  return newCyclePlan;
}

// -------------------------------------------------------------
// ATOMIC SAVE ALL (Instant multi-device persistence)
// -------------------------------------------------------------
export function saveAll(
  weeks: WeekPlan[],
  history: WorkoutHistoryEntry[],
  active: { weekNumber: number; dayIndex: number; unit: WeightUnit }
) {
  const verifiedWeeks = ensureSixWeeks(weeks);
  cachedWeeks = verifiedWeeks;
  cachedHistory = history;
  cachedActive = active;
  lastLocalEditTimestamp = Date.now();
  if (typeof window === 'undefined') return;

  emitSave('saving');
  try {
    localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(verifiedWeeks));
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    localStorage.setItem(STORAGE_KEYS.ACTIVE, JSON.stringify(active));
    crossTabChannel?.postMessage({ type: 'plan', data: verifiedWeeks });
    crossTabChannel?.postMessage({ type: 'history', data: history });
    crossTabChannel?.postMessage({ type: 'settings', data: active });
    pushAllToCloud(verifiedWeeks, history, active);
    emitSave('saved');
  } catch (err) {
    console.error('Failed to save all to storage', err);
  }
}

// -------------------------------------------------------------
// ALWAYS-ON CONTINUOUS BACKGROUND MULTI-DEVICE SYNC ENGINE
// -------------------------------------------------------------
let isSyncInitialized = false;
let lastSyncedServerTimestamp: string | null = null;
let isAutoSyncRunning = false;

export async function performContinuousCloudSync(force = false) {
  if (typeof window === 'undefined' || isAutoSyncRunning) return;

  // Protect local changes: if the user recently edited anything locally (< 5s ago), do not pull and overwrite!
  if (!force && Date.now() - lastLocalEditTimestamp < 5000) {
    return;
  }

  isAutoSyncRunning = true;

  try {
    const cloudData = await pullAllFromCloud();
    if (!cloudData) {
      isAutoSyncRunning = false;
      return;
    }

    const { plan: cloudPlan, history: cloudHistory, settings: cloudSettings, updatedAt: serverTime } = cloudData;

    const localRawWeeks = localStorage.getItem(STORAGE_KEYS.WEEKS);
    const localWeeks = localRawWeeks ? JSON.parse(localRawWeeks) : null;
    const localHasExercises =
      localWeeks &&
      Array.isArray(localWeeks) &&
      localWeeks.some((w: any) => w.days?.some((d: any) => d.exercises?.length > 0));

    const serverHasExercises =
      cloudPlan &&
      Array.isArray(cloudPlan) &&
      cloudPlan.some((w: any) => w.days?.some((d: any) => d.exercises?.length > 0));

    // Case 1: First-time seed / Upload to Server & Supabase
    // Local device has exercises, but cloud database is empty of exercises
    if (localHasExercises && !serverHasExercises) {
      const active = getActiveSelection();
      const hist = getSavedHistory();
      await pushAllToCloud(localWeeks, hist, active);
      lastSyncedServerTimestamp = new Date().toISOString();
      isAutoSyncRunning = false;
      return;
    }

    // Case 2: Cloud has real exercises, but local device is empty (e.g. mobile opening for the first time)
    // -> Pull cloud workouts to local device automatically!
    if (serverHasExercises && !localHasExercises) {
      lastSyncedServerTimestamp = serverTime;
      const validServerWeeks = ensureSixWeeks(cloudPlan!);
      const serverWeeksStr = JSON.stringify(validServerWeeks);
      cachedWeeks = validServerWeeks;
      localStorage.setItem(STORAGE_KEYS.WEEKS, serverWeeksStr);
      planListeners.forEach((l) => l(validServerWeeks));

      if (Array.isArray(cloudHistory)) {
        cachedHistory = cloudHistory;
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(cloudHistory));
        historyListeners.forEach((l) => l(cloudHistory));
      }

      if (cloudSettings && typeof cloudSettings === 'object') {
        cachedActive = cloudSettings;
        localStorage.setItem(STORAGE_KEYS.ACTIVE, JSON.stringify(cloudSettings));
        settingsListeners.forEach((l) => l(cloudSettings));
      }

      notifyCloudStatus('synced', 'Database Synced', false);
      isAutoSyncRunning = false;
      return;
    }

    // Case 3: Both have exercises -> smart set-level & day-level merge!
    if (serverHasExercises && localHasExercises) {
      if (force || serverTime !== lastSyncedServerTimestamp) {
        lastSyncedServerTimestamp = serverTime;
        const validServerWeeks = ensureSixWeeks(cloudPlan!);
        const mergedWeeks = mergeWeekPlans(localWeeks, validServerWeeks);
        const mergedWeeksStr = JSON.stringify(mergedWeeks);
        if (localRawWeeks !== mergedWeeksStr) {
          cachedWeeks = mergedWeeks;
          localStorage.setItem(STORAGE_KEYS.WEEKS, mergedWeeksStr);
          planListeners.forEach((l) => l(mergedWeeks));
        }
      }
    }

    // HISTORY MERGE: Always merge cloud and local history so no workout on ANY device is ever lost!
    if (Array.isArray(cloudHistory)) {
      const localHistory = getSavedHistory();
      const map = new Map<string, WorkoutHistoryEntry>();
      localHistory.forEach((h) => map.set(h.id, h));
      cloudHistory.forEach((h) => map.set(h.id, h));

      const mergedHistory = Array.from(map.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const localHistStr = JSON.stringify(localHistory);
      const mergedHistStr = JSON.stringify(mergedHistory);

      if (localHistStr !== mergedHistStr) {
        cachedHistory = mergedHistory;
        localStorage.setItem(STORAGE_KEYS.HISTORY, mergedHistStr);
        historyListeners.forEach((l) => l(mergedHistory));

        // If local had workouts that were missing in the cloud, mirror merged history back to cloud!
        if (mergedHistory.length > cloudHistory.length) {
          pushHistoryToCloud(mergedHistory);
        }
      }
    }

    // SETTINGS MERGE: Pull active settings if available
    if (cloudSettings && typeof cloudSettings === 'object') {
      const localActiveRaw = localStorage.getItem(STORAGE_KEYS.ACTIVE);
      const serverSettingsStr = JSON.stringify(cloudSettings);
      if (localActiveRaw !== serverSettingsStr) {
        cachedActive = cloudSettings;
        localStorage.setItem(STORAGE_KEYS.ACTIVE, serverSettingsStr);
        settingsListeners.forEach((l) => l(cloudSettings));
      }
    }

    notifyCloudStatus('synced', 'Database Synced', false);
  } catch (err) {
    // Offline or network hiccup - silent retry
  } finally {
    isAutoSyncRunning = false;
  }
}

// -------------------------------------------------------------
// LOSSLESS 6-WEEK PLAN MERGING (Never drops checked-off sets)
// -------------------------------------------------------------
export function mergeWeekPlans(localWeeks: WeekPlan[], cloudWeeks: WeekPlan[]): WeekPlan[] {
  const merged = ensureSixWeeks(cloudWeeks);
  const local = ensureSixWeeks(localWeeks);

  for (let w = 0; w < 6; w++) {
    const localWeek = local[w];
    const mergedWeek = merged[w];
    if (!localWeek || !mergedWeek) continue;

    for (let d = 0; d < 7; d++) {
      const localDay = localWeek.days[d];
      const mergedDay = mergedWeek.days[d];
      if (!localDay || !mergedDay) continue;

      if (localDay.completed) {
        mergedDay.completed = true;
      }

      mergedDay.exercises.forEach((mergedEx, exIdx) => {
        const localEx = localDay.exercises[exIdx];
        if (!localEx || localEx.name !== mergedEx.name) return;

        if (localEx.completed) {
          mergedEx.completed = true;
        }

        mergedEx.sets.forEach((mergedSet, setIdx) => {
          const localSet = localEx.sets[setIdx];
          if (!localSet) return;

          // If either device completed the set, keep it completed!
          if (localSet.completed) {
            mergedSet.completed = true;
          }

          // If local set has recorded weight and cloud was blank, keep local weight
          if ((mergedSet.load === '' || mergedSet.load === 0) && localSet.load !== '' && localSet.load > 0) {
            mergedSet.load = localSet.load;
          }
        });

        if (mergedEx.sets.length > 0 && mergedEx.sets.every((s) => s.completed)) {
          mergedEx.completed = true;
        }
      });

      if (mergedDay.exercises.length > 0 && mergedDay.exercises.every((e) => e.completed)) {
        mergedDay.completed = true;
      }
    }
  }

  return merged;
}

// User activity tracking for smart adaptive heartbeat
let lastUserInteractionTime = Date.now();
if (typeof window !== 'undefined') {
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((evt) => {
    window.addEventListener(evt, () => {
      lastUserInteractionTime = Date.now();
    }, { passive: true });
  });
}

export function initBackgroundCloudSync() {
  if (typeof window === 'undefined' || isSyncInitialized) return;
  isSyncInitialized = true;

  // 1. Initial immediate sync on mount
  performContinuousCloudSync(true);

  // 2. Instant sync when user unlocks phone, returns to app, or focuses window
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      lastUserInteractionTime = Date.now();
      performContinuousCloudSync(false);
    }
  });

  window.addEventListener('focus', () => {
    lastUserInteractionTime = Date.now();
    performContinuousCloudSync(false);
  });

  window.addEventListener('online', () => {
    lastUserInteractionTime = Date.now();
    performContinuousCloudSync(true);
  });

  // 3. Adaptive battery-friendly heartbeat loop (8s active -> 18s rest timer -> 45s idle)
  let adaptiveTimer: any = null;
  const scheduleNextHeartbeat = () => {
    if (adaptiveTimer) clearTimeout(adaptiveTimer);
    if (typeof document === 'undefined') return;

    const idleMs = Date.now() - lastUserInteractionTime;
    let nextDelay = 8000; // 8s default when user is actively logging sets

    if (idleMs > 60000) {
      nextDelay = 45000; // 45s battery-saver when phone is resting on bench
    } else if (idleMs > 20000) {
      nextDelay = 18000; // 18s rest timer cadence
    }

    adaptiveTimer = setTimeout(() => {
      if (document.visibilityState === 'visible') {
        performContinuousCloudSync(false);
      }
      scheduleNextHeartbeat();
    }, nextDelay);
  };

  scheduleNextHeartbeat();

  // 4. Supabase Realtime channel subscription (instant sub-second multi-device push)
  if (isSupabaseConfigured && supabase) {
    try {
      supabase
        .channel('public:workout_sync_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'workout_plan' },
          () => performContinuousCloudSync(true)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'workout_history' },
          () => performContinuousCloudSync(true)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'app_settings' },
          () => performContinuousCloudSync(true)
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
    const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    if (!parsed || !Array.isArray(parsed.weeks)) {
      throw new Error('Invalid workout data format.');
    }
    if (typeof window !== 'undefined') {
      const validWeeks = ensureSixWeeks(parsed.weeks);
      cachedWeeks = validWeeks;
      localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(validWeeks));
      planListeners.forEach((l) => l(validWeeks));

      if (Array.isArray(parsed.library)) {
        cachedLibrary = parsed.library;
        localStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(parsed.library));
      }
      if (Array.isArray(parsed.history)) {
        cachedHistory = parsed.history;
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(parsed.history));
        historyListeners.forEach((l) => l(parsed.history));
      }
      if (parsed.activeSelection) {
        cachedActive = parsed.activeSelection;
        localStorage.setItem(STORAGE_KEYS.ACTIVE, JSON.stringify(parsed.activeSelection));
        settingsListeners.forEach((l) => l(parsed.activeSelection));
      }
      emitSave('saved');
      debouncedPushPlanToCloud(validWeeks);
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
