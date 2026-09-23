import { supabase, isSupabaseConfigured } from './supabaseClient';
import { WeekPlan, WorkoutHistoryEntry, WeightUnit } from '../types/workout';

export type CloudSyncStatus = 'synced' | 'syncing' | 'offline' | 'pending_setup' | 'error' | 'disabled';

export interface CloudSyncInfo {
  status: CloudSyncStatus;
  message?: string;
  lastSyncedAt?: string | null;
}

type CloudSyncListener = (info: CloudSyncInfo) => void;
const listeners = new Set<CloudSyncListener>();

let currentInfo: CloudSyncInfo = {
  status: isSupabaseConfigured ? 'syncing' : 'disabled',
  message: isSupabaseConfigured ? 'Connecting to Supabase...' : 'Supabase credentials not configured',
  lastSyncedAt: null,
};

export function getCloudSyncInfo(): CloudSyncInfo {
  return currentInfo;
}

export function onCloudStatus(listener: CloudSyncListener): () => void {
  listeners.add(listener);
  listener(currentInfo);
  return () => {
    listeners.delete(listener);
  };
}

function notifyStatus(status: CloudSyncStatus, message?: string) {
  currentInfo = {
    status,
    message: message || '',
    lastSyncedAt: status === 'synced' ? new Date().toLocaleTimeString() : currentInfo.lastSyncedAt,
  };
  listeners.forEach((l) => l(currentInfo));
}

// Check network status
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (currentInfo.status === 'offline') {
      notifyStatus('syncing', 'Reconnected. Syncing with Supabase...');
      pullPlanFromCloud();
    }
  });

  window.addEventListener('offline', () => {
    notifyStatus('offline', 'Offline (All changes saved locally)');
  });
}

// -------------------------------------------------------------
// PUSH PLAN TO SUPABASE
// -------------------------------------------------------------
let pushPlanTimer: any = null;

export function debouncedPushPlanToCloud(weeks: WeekPlan[], delayMs = 1200) {
  if (typeof window === 'undefined' || !isSupabaseConfigured || !supabase) return;
  clearTimeout(pushPlanTimer);
  pushPlanTimer = setTimeout(() => {
    pushPlanToCloud(weeks);
  }, delayMs);
}

export async function pushPlanToCloud(weeks: WeekPlan[]): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notifyStatus('offline', 'Offline (changes saved locally)');
    return false;
  }

  notifyStatus('syncing', 'Saving plan to Supabase...');

  try {
    const { error } = await supabase
      .from('workout_plan')
      .upsert(
        {
          id: 'default_plan',
          weeks: weeks,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (error) {
      if (
        error.code === 'PGRST205' ||
        error.message?.includes('schema cache') ||
        error.message?.includes('does not exist')
      ) {
        notifyStatus('pending_setup', 'Tables need to be created in Supabase SQL editor');
        return false;
      }
      console.warn('[Supabase Sync Plan Error]', error);
      notifyStatus('error', error.message);
      return false;
    }

    notifyStatus('synced', 'All changes synced to Supabase');
    return true;
  } catch (err: any) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      notifyStatus('offline', 'Offline (changes saved locally)');
    } else {
      notifyStatus('error', err?.message || 'Sync failed');
    }
    return false;
  }
}

// -------------------------------------------------------------
// PULL PLAN FROM SUPABASE
// -------------------------------------------------------------
export async function pullPlanFromCloud(): Promise<WeekPlan[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notifyStatus('offline', 'Offline (local mode active)');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('workout_plan')
      .select('weeks, updated_at')
      .eq('id', 'default_plan')
      .maybeSingle();

    if (error) {
      if (
        error.code === 'PGRST205' ||
        error.message?.includes('schema cache') ||
        error.message?.includes('does not exist')
      ) {
        notifyStatus('pending_setup', 'Setup needed: run SQL script in Supabase');
        return null;
      }
      notifyStatus('error', error.message);
      return null;
    }

    if (data && Array.isArray(data.weeks) && data.weeks.length === 4) {
      notifyStatus('synced', 'Synced with Supabase');
      return data.weeks as WeekPlan[];
    }

    notifyStatus('synced', 'Connected to Supabase');
    return null;
  } catch (err: any) {
    return null;
  }
}

// -------------------------------------------------------------
// HISTORY SYNC
// -------------------------------------------------------------
export async function pushHistoryToCloud(history: WorkoutHistoryEntry[]): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || history.length === 0) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

  try {
    const rows = history.map((entry) => ({
      id: entry.id,
      session_date: entry.date,
      day_title: entry.workoutTitle,
      week_number: entry.weekNumber,
      sets: entry.exercises,
      duration_minutes: 0,
      notes: '',
      created_at: entry.date,
    }));

    const { error } = await supabase
      .from('workout_history')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.warn('[Supabase Sync History Notice]', error.message);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

export async function pullHistoryFromCloud(): Promise<WorkoutHistoryEntry[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;

  try {
    const { data, error } = await supabase
      .from('workout_history')
      .select('*')
      .order('session_date', { ascending: false });

    if (error || !data) return null;

    const entries: WorkoutHistoryEntry[] = data.map((row: any) => ({
      id: row.id,
      date: row.session_date || row.created_at,
      weekNumber: row.week_number || 1,
      dayOfWeek: new Date(row.session_date || row.created_at).toLocaleDateString('en-US', {
        weekday: 'long',
      }),
      workoutTitle: row.day_title || 'Workout Session',
      completedExercises: Array.isArray(row.sets) ? row.sets.length : 0,
      totalExercises: Array.isArray(row.sets) ? row.sets.length : 0,
      completedSets: Array.isArray(row.sets)
        ? row.sets.reduce(
            (sum: number, ex: any) =>
              sum + (Array.isArray(ex.sets) ? ex.sets.filter((s: any) => s.completed).length : 0),
            0
          )
        : 0,
      totalSets: Array.isArray(row.sets)
        ? row.sets.reduce(
            (sum: number, ex: any) => sum + (Array.isArray(ex.sets) ? ex.sets.length : 0),
            0
          )
        : 0,
      exercises: Array.isArray(row.sets) ? row.sets : [],
    }));

    return entries;
  } catch (err) {
    return null;
  }
}

// -------------------------------------------------------------
// SETTINGS SYNC
// -------------------------------------------------------------
export async function pushSettingsToCloud(settings: {
  weekNumber: number;
  dayIndex: number;
  unit: WeightUnit;
}): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    await supabase.from('app_settings').upsert(
      {
        id: 'settings',
        settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    return true;
  } catch {
    return false;
  }
}

export async function pullSettingsFromCloud(): Promise<{
  weekNumber: number;
  dayIndex: number;
  unit: WeightUnit;
} | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('settings')
      .eq('id', 'settings')
      .maybeSingle();

    if (data && data.settings) {
      return data.settings;
    }
    return null;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// DIAGNOSTICS & MANUAL ACTIONS
// -------------------------------------------------------------
export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  tableFound: boolean;
  message: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      connected: false,
      tableFound: false,
      message: 'Supabase credentials are not configured in .env.local',
    };
  }

  try {
    const { data, error } = await supabase.from('workout_plan').select('id').limit(1);

    if (error) {
      if (
        error.code === 'PGRST205' ||
        error.message?.includes('schema cache') ||
        error.message?.includes('does not exist')
      ) {
        notifyStatus('pending_setup', 'Setup needed: run SQL script in Supabase');
        return {
          connected: true,
          tableFound: false,
          message:
            "Connected to project ftssrejkpjyrzkgkkfnz, but table 'workout_plan' not found. Please run the SQL script in Supabase SQL Editor.",
        };
      }
      notifyStatus('error', error.message);
      return {
        connected: false,
        tableFound: false,
        message: error.message,
      };
    }

    notifyStatus('synced', 'Connected to Supabase');
    return {
      connected: true,
      tableFound: true,
      message: 'Successfully connected and verified database tables!',
    };
  } catch (err: any) {
    notifyStatus('error', err?.message || 'Connection test failed');
    return {
      connected: false,
      tableFound: false,
      message: err?.message || 'Connection test failed',
    };
  }
}
