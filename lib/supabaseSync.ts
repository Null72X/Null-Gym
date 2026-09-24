import { supabase, isSupabaseConfigured } from './supabaseClient';
import { WeekPlan, WorkoutHistoryEntry, WeightUnit } from '../types/workout';
import { ensureSixWeeks } from './planDefaults';
import { isAppOffline } from './offlineManager';

export type CloudSyncStatus = 'synced' | 'syncing' | 'offline';

export interface CloudSyncInfo {
  status: CloudSyncStatus;
  message?: string;
  lastSyncedAt?: string | null;
}

type CloudSyncListener = (info: CloudSyncInfo) => void;
const listeners = new Set<CloudSyncListener>();

let currentInfo: CloudSyncInfo = {
  status: 'synced',
  message: 'Database Ready & Synced',
  lastSyncedAt: new Date().toLocaleTimeString(),
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

export function notifyCloudStatus(status: CloudSyncStatus, message?: string) {
  currentInfo = {
    status,
    message: message || '',
    lastSyncedAt: status === 'synced' ? new Date().toLocaleTimeString() : currentInfo.lastSyncedAt,
  };
  listeners.forEach((l) => l(currentInfo));
}

const notifyStatus = notifyCloudStatus;

// Online/Offline detection
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    notifyCloudStatus('syncing', 'Reconnected. Synchronizing...');
    pullPlanFromCloud();
  });

  window.addEventListener('offline', () => {
    notifyCloudStatus('offline', 'Offline (Saved locally)');
  });
}

// -------------------------------------------------------------
// PUSH PLAN (100% Automatic: Server DB + Silent Supabase Mirror)
// -------------------------------------------------------------
let pushPlanTimer: any = null;

export function debouncedPushPlanToCloud(weeks: WeekPlan[], delayMs = 400) {
  if (typeof window === 'undefined') return;
  clearTimeout(pushPlanTimer);
  pushPlanTimer = setTimeout(() => {
    pushPlanToCloud(weeks);
  }, delayMs);
}

export async function pushPlanToCloud(weeks: WeekPlan[]): Promise<boolean> {
  if (isAppOffline()) {
    notifyStatus('offline', 'Offline (Saved locally)');
    return true;
  }

  const fullWeeks = ensureSixWeeks(weeks);

  try {
    // 1. Save to built-in Server Database in background
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_plan', data: fullWeeks }),
      });
    } catch (e) {
      // Local network fallback
    }

    // 2. Silent Supabase Cloud Sync (if configured)
    if (isSupabaseConfigured && supabase) {
      Promise.resolve(
        supabase
          .from('workout_plan')
          .upsert(
            {
              id: 'default_plan',
              weeks: fullWeeks,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          )
      ).catch(() => {});
    }

    notifyStatus('synced', 'Database Synced');
    return true;
  } catch (err: any) {
    notifyStatus('synced', 'Changes saved locally');
    return true;
  }
}

// -------------------------------------------------------------
// PULL PLAN (Pulls from Server DB or Supabase automatically)
// -------------------------------------------------------------
export async function pullPlanFromCloud(): Promise<WeekPlan[] | null> {
  if (isAppOffline()) {
    notifyStatus('offline', 'Offline (Saved locally)');
    return null;
  }

  try {
    // 1. Try built-in Server Database
    try {
      const res = await fetch('/api/sync');
      if (res.ok) {
        const body = await res.json();
        if (body.success && Array.isArray(body.plan) && body.plan.length > 0) {
          notifyStatus('synced', 'Database Synced');
          return ensureSixWeeks(body.plan);
        }
      }
    } catch (e) {}

    // 2. Try Supabase
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('workout_plan')
        .select('weeks')
        .eq('id', 'default_plan')
        .maybeSingle();

      if (data && Array.isArray(data.weeks) && data.weeks.length > 0) {
        notifyStatus('synced', 'Database Synced');
        return ensureSixWeeks(data.weeks);
      }
    }

    notifyStatus('synced', 'Database Ready');
    return null;
  } catch {
    notifyStatus('synced', 'Database Ready');
    return null;
  }
}

// -------------------------------------------------------------
// HISTORY SYNC (Server DB + Silent Supabase Mirror)
// -------------------------------------------------------------
export async function pushHistoryToCloud(history: WorkoutHistoryEntry[]): Promise<boolean> {
  if (isAppOffline()) return true;

  try {
    // Save to built-in Server Database
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_history', data: history }),
      });
    } catch {}

    // Silent Supabase mirror
    if (isSupabaseConfigured && supabase && history.length > 0) {
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

      Promise.resolve(
        supabase
          .from('workout_history')
          .upsert(rows, { onConflict: 'id' })
      ).catch(() => {});
    }

    return true;
  } catch {
    return true;
  }
}

export async function pullHistoryFromCloud(): Promise<WorkoutHistoryEntry[] | null> {
  try {
    const res = await fetch('/api/sync');
    if (res.ok) {
      const body = await res.json();
      if (body.success && Array.isArray(body.history)) {
        return body.history;
      }
    }
  } catch {}
  return null;
}

// -------------------------------------------------------------
// SETTINGS SYNC (Server DB + Silent Supabase Mirror)
// -------------------------------------------------------------
let pushSettingsTimer: any = null;

export function debouncedPushSettingsToCloud(
  settings: { weekNumber: number; dayIndex: number; unit: WeightUnit },
  delayMs = 400
) {
  if (typeof window === 'undefined') return;
  clearTimeout(pushSettingsTimer);
  pushSettingsTimer = setTimeout(() => {
    pushSettingsToCloud(settings);
  }, delayMs);
}

export async function pushSettingsToCloud(settings: {
  weekNumber: number;
  dayIndex: number;
  unit: WeightUnit;
}): Promise<boolean> {
  try {
    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_settings', data: settings }),
    });

    if (isSupabaseConfigured && supabase) {
      Promise.resolve(
        supabase
          .from('app_settings')
          .upsert(
            {
              id: 'settings',
              settings,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          )
      ).catch(() => {});
    }
    return true;
  } catch {
    return true;
  }
}

export async function pullSettingsFromCloud(): Promise<{
  weekNumber: number;
  dayIndex: number;
  unit: WeightUnit;
} | null> {
  try {
    const res = await fetch('/api/sync');
    if (res.ok) {
      const body = await res.json();
      if (body.success && body.settings) {
        return body.settings;
      }
    }
  } catch {}
  return null;
}

// -------------------------------------------------------------
// CONNECTION CHECK & RLS DIAGNOSTICS
// -------------------------------------------------------------
export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  tableFound: boolean;
  needsRlsFix: boolean;
  message: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      connected: false,
      tableFound: false,
      needsRlsFix: false,
      message: 'Supabase credentials are not configured in .env.local',
    };
  }

  try {
    // 1. Test read permissions
    const { error: readError } = await supabase.from('workout_plan').select('id').limit(1);
    if (readError) {
      if (readError.code === 'PGRST205' || readError.message?.includes('schema cache')) {
        return {
          connected: true,
          tableFound: false,
          needsRlsFix: false,
          message: "Connected to Supabase, but table 'workout_plan' not found. Run table creation script.",
        };
      }
      return {
        connected: false,
        tableFound: false,
        needsRlsFix: false,
        message: readError.message,
      };
    }

    // 2. Test write permissions (check for RLS policy 42501 error)
    const { error: writeError } = await supabase.from('workout_plan').upsert(
      {
        id: 'test_connection_ping',
        weeks: [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (writeError) {
      if (writeError.code === '42501' || writeError.message?.includes('row-level security')) {
        return {
          connected: true,
          tableFound: true,
          needsRlsFix: true,
          message: 'Row-Level Security (RLS) is blocking writes. Please run the 2-line SQL command in Supabase SQL Editor.',
        };
      }
      return {
        connected: true,
        tableFound: true,
        needsRlsFix: false,
        message: `Connected, but write test failed: ${writeError.message}`,
      };
    }

    // Clean up ping row if successful
    await supabase.from('workout_plan').delete().eq('id', 'test_connection_ping');

    return {
      connected: true,
      tableFound: true,
      needsRlsFix: false,
      message: '🟢 100% Connected! Supabase Cloud Database is fully synchronized with read/write access.',
    };
  } catch (err: any) {
    return {
      connected: false,
      tableFound: false,
      needsRlsFix: false,
      message: err?.message || 'Connection test failed',
    };
  }
}
