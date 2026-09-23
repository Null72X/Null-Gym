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
  pushSettingsToCloud,
  pullSettingsFromCloud,
} from './supabaseSync';

const STORAGE_KEYS = {
  WEEKS: 'gym_weeks_v6',
  HISTORY: 'gym_history_v6',
  LIBRARY: 'gym_library_v6',
  ACTIVE: 'gym_active_v6',
  PROGRESSION: 'gym_progression_v6',
};

// 570 Master exercise library with YouTube search links and intelligent tracking types
export const DEFAULT_LIBRARY: ExerciseLibraryItem[] = ALL_CATALOG_EXERCISES;

// Helper to create blank 6 weeks with zero exercises
export function createBlankWeeks(): WeekPlan[] {
  const dayNames: DayWorkout['dayOfWeek'][] = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  return Array.from({ length: 6 }, (_, wIdx) => ({
    weekNumber: wIdx + 1,
    days: dayNames.map((d, dIdx) => ({
      id: `w${wIdx + 1}_d${dIdx}`,
      dayOfWeek: d,
      title: d === 'Sunday' ? 'Rest Day' : d,
      focus: d === 'Sunday' ? 'Rest & Recovery' : '',
      isRestDay: d === 'Sunday',
      exercises: [],
    })),
  }));
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

// STORAGE ACCESSORS
export function getSavedWeeks(): WeekPlan[] {
  if (typeof window === 'undefined') return createBlankWeeks();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WEEKS);
    if (!raw) {
      const initial = createBlankWeeks();
      localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const initial = createBlankWeeks();
      localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(initial));
      return initial;
    }
    if (parsed.length < 6) {
      // Seamlessly upgrade 4-week plans to 6 weeks without losing any user data!
      const blank = createBlankWeeks();
      const expanded = [
        ...parsed,
        ...blank.slice(parsed.length),
      ];
      localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(expanded));
      return expanded;
    }
    return parsed;
  } catch (err) {
    console.error('Failed to load weeks from storage', err);
    return createBlankWeeks();
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
  if (typeof window === 'undefined') return;
  emitSave('saving');
  try {
    localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(weeks));
    debouncedPushPlanToCloud(weeks);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      emitSave('saved');
    }, 400);
  } catch (err) {
    console.error('Failed to save weeks', err);
  }
}

export function getSavedLibrary(): ExerciseLibraryItem[] {
  if (typeof window === 'undefined') return DEFAULT_LIBRARY;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LIBRARY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(DEFAULT_LIBRARY));
      return DEFAULT_LIBRARY;
    }
    return JSON.parse(raw);
  } catch (err) {
    return DEFAULT_LIBRARY;
  }
}

export function saveLibrary(library: ExerciseLibraryItem[]) {
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
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

export function saveHistory(history: WorkoutHistoryEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    pushHistoryToCloud(history);
  } catch (err) {
    console.error('Failed to save history', err);
  }
}

export function getActiveSelection(): { weekNumber: number; dayIndex: number; unit: WeightUnit } {
  if (typeof window === 'undefined') return { weekNumber: 1, dayIndex: 0, unit: 'kg' };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE);
    if (!raw) return { weekNumber: 1, dayIndex: 0, unit: 'kg' };
    const parsed = JSON.parse(raw);
    const weekNumber = Math.min(6, Math.max(1, parsed.weekNumber || 1));
    const dayIndex = Math.min(6, Math.max(0, parsed.dayIndex || 0));
    return { weekNumber, dayIndex, unit: parsed.unit || 'kg' };
  } catch (err) {
    return { weekNumber: 1, dayIndex: 0, unit: 'kg' };
  }
}

export function saveActiveSelection(active: {
  weekNumber: number;
  dayIndex: number;
  unit: WeightUnit;
}) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE, JSON.stringify(active));
    pushSettingsToCloud(active);
  } catch (err) {
    console.error('Failed to save active selection', err);
  }
}

export function getProgressionConfig(): ProgressionConfig {
  if (typeof window === 'undefined') return DEFAULT_PROGRESSION_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROGRESSION);
    if (!raw) return DEFAULT_PROGRESSION_CONFIG;
    return { ...DEFAULT_PROGRESSION_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROGRESSION_CONFIG;
  }
}

export function saveProgressionConfig(config: ProgressionConfig) {
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
// CLOUD BACKGROUND SYNC INITIALIZER
// -------------------------------------------------------------
let isSyncInitialized = false;

export function initBackgroundCloudSync() {
  if (typeof window === 'undefined' || isSyncInitialized) return;
  isSyncInitialized = true;

  // Pull plan from cloud
  pullPlanFromCloud().then((cloudWeeks) => {
    if (cloudWeeks && Array.isArray(cloudWeeks) && cloudWeeks.length >= 4) {
      const validCloudWeeks =
        cloudWeeks.length < 6
          ? [...cloudWeeks, ...createBlankWeeks().slice(cloudWeeks.length)]
          : cloudWeeks;
      const localRaw = localStorage.getItem(STORAGE_KEYS.WEEKS);
      const localWeeks = localRaw ? JSON.parse(localRaw) : null;

      const localHasExercises =
        localWeeks &&
        localWeeks.some((w: any) => w.days.some((d: any) => d.exercises?.length > 0));
      const cloudHasExercises = validCloudWeeks.some((w: any) =>
        w.days.some((d: any) => d.exercises?.length > 0)
      );

      if (!localHasExercises && cloudHasExercises) {
        // Fresh device or empty local cache -> use cloud data!
        localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(validCloudWeeks));
        planListeners.forEach((l) => l(validCloudWeeks));
      } else if (localHasExercises && !cloudHasExercises) {
        // Initial cloud upload!
        pushPlanToCloud(localWeeks);
      } else {
        // Sync cloud plan
        localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(validCloudWeeks));
        planListeners.forEach((l) => l(validCloudWeeks));
      }
    } else {
      // Cloud is blank or table newly initialized -> push local data to cloud
      const localRaw = localStorage.getItem(STORAGE_KEYS.WEEKS);
      if (localRaw) {
        try {
          const localWeeks = JSON.parse(localRaw);
          pushPlanToCloud(localWeeks);
        } catch {}
      }
    }
  });

  // Pull history from cloud
  pullHistoryFromCloud().then((cloudHistory) => {
    if (cloudHistory && cloudHistory.length > 0) {
      const localRaw = localStorage.getItem(STORAGE_KEYS.HISTORY);
      const localHistory = localRaw ? JSON.parse(localRaw) : [];
      if (cloudHistory.length >= localHistory.length) {
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(cloudHistory));
      }
    }
  });

  // Pull settings from cloud
  pullSettingsFromCloud().then((cloudSettings) => {
    if (cloudSettings) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE, JSON.stringify(cloudSettings));
    }
  });
}

// -------------------------------------------------------------
// MANUAL CLOUD SYNC ACTIONS (FOR SETTINGS PAGE)
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
  const cloudWeeks = await pullPlanFromCloud();
  const cloudHistory = await pullHistoryFromCloud();
  const cloudSettings = await pullSettingsFromCloud();

  let updated = false;
  if (cloudWeeks && cloudWeeks.length >= 4) {
    const validCloudWeeks =
      cloudWeeks.length < 6
        ? [...cloudWeeks, ...createBlankWeeks().slice(cloudWeeks.length)]
        : cloudWeeks;
    localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(validCloudWeeks));
    planListeners.forEach((l) => l(validCloudWeeks));
    updated = true;
  }
  if (cloudHistory) {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(cloudHistory));
    updated = true;
  }
  if (cloudSettings) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE, JSON.stringify(cloudSettings));
    updated = true;
  }
  return updated;
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
      localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(parsed.weeks));
      if (Array.isArray(parsed.library)) {
        localStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(parsed.library));
      }
      if (Array.isArray(parsed.history)) {
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(parsed.history));
      }
      if (parsed.activeSelection) {
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
