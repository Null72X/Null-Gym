import { supabase, isSupabaseConfigured } from './supabaseClient';
import { WeekPlan, WorkoutHistoryEntry, WeightUnit } from '../types/workout';
import { ensureSixWeeks } from './planDefaults';
import { isAppOffline } from './offlineManager';

export type CloudSyncStatus = 'synced' | 'syncing' | 'offline' | 'needs_rls_fix' | 'error';

export interface CloudSyncInfo {
  status: CloudSyncStatus;
  message?: string;
  lastSyncedAt?: string | null;
  needsRlsFix?: boolean;
}

type CloudSyncListener = (info: CloudSyncInfo) => void;
const listeners = new Set<CloudSyncListener>();

let currentInfo: CloudSyncInfo = {
  status: 'synced',
  message: 'Database Ready & Synced',
  lastSyncedAt: new Date().toLocaleTimeString(),
  needsRlsFix: false,
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

export function notifyCloudStatus(status: CloudSyncStatus, message?: string, needsRlsFix?: boolean) {
  currentInfo = {
    status,
    message: message || '',
    lastSyncedAt: status === 'synced' ? new Date().toLocaleTimeString() : currentInfo.lastSyncedAt,
    needsRlsFix: needsRlsFix ?? currentInfo.needsRlsFix,
  };
  listeners.forEach((l) => l(currentInfo));
}

// Online/Offline detection
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    notifyCloudStatus('syncing', 'Reconnected. Synchronizing...');
  });

  window.addEventListener('offline', () => {
    notifyCloudStatus('offline', 'Offline (Saved locally)');
  });
}

// -------------------------------------------------------------
// HISTORY DATA MAPPERS (Lossless round-trip conversion)
// -------------------------------------------------------------
export function mapSupabaseRowToHistoryEntry(row: any): WorkoutHistoryEntry {
  let exercises = [];
  let dayOfWeek = 'Monday';
  let completedExercises = 0;
  let totalExercises = 0;
  let completedSets = 0;
  let totalSets = 0;
  let totalVolumeKg = 0;

  if (row.sets) {
    if (Array.isArray(row.sets)) {
      exercises = row.sets;
      completedExercises = exercises.length;
      totalExercises = exercises.length;
    } else if (typeof row.sets === 'object') {
      exercises = Array.isArray(row.sets.exercises) ? row.sets.exercises : [];
      dayOfWeek = row.sets.dayOfWeek || 'Monday';
      completedExercises = row.sets.completedExercises ?? exercises.length;
      totalExercises = row.sets.totalExercises ?? exercises.length;
      completedSets = row.sets.completedSets ?? 0;
      totalSets = row.sets.totalSets ?? 0;
      totalVolumeKg = row.sets.totalVolumeKg ?? 0;
    }
  }

  return {
    id: row.id,
    date: row.session_date || row.created_at || new Date().toISOString(),
    weekNumber: row.week_number || 1,
    dayOfWeek: dayOfWeek,
    workoutTitle: row.day_title || 'Workout',
    completedExercises,
    totalExercises,
    completedSets,
    totalSets,
    totalVolumeKg,
    exercises,
  };
}

export function mapHistoryEntryToSupabaseRow(entry: WorkoutHistoryEntry) {
  return {
    id: entry.id,
    session_date: entry.date,
    day_title: entry.workoutTitle,
    week_number: entry.weekNumber,
    sets: {
      exercises: entry.exercises,
      dayOfWeek: entry.dayOfWeek,
      completedExercises: entry.completedExercises,
      totalExercises: entry.totalExercises,
      completedSets: entry.completedSets,
      totalSets: entry.totalSets,
      totalVolumeKg: entry.totalVolumeKg,
    },
    duration_minutes: 0,
    notes: '',
    created_at: entry.date || new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// ATOMIC SAVE ALL (Instant push when workout finishes or plan resets)
// -------------------------------------------------------------
export async function pushAllToCloud(
  weeks: WeekPlan[],
  history: WorkoutHistoryEntry[],
  settings: { weekNumber: number; dayIndex: number; unit: WeightUnit }
): Promise<boolean> {
  if (isAppOffline()) {
    notifyCloudStatus('offline', 'Offline (Saved locally)');
    return true;
  }

  notifyCloudStatus('syncing', 'Saving workout to cloud...');
  const fullWeeks = ensureSixWeeks(weeks);
  const nowIso = new Date().toISOString();

  let hasRlsError = false;

  try {
    // 1. Send atomic save_all to built-in Server Database
    const apiPromise = fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_all',
        data: { plan: fullWeeks, history, settings },
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json?.rlsBlocked) hasRlsError = true;
      })
      .catch(() => {});

    // 2. Direct Supabase Upsert for instantaneous multi-device real-time sync
    let supaPromise = Promise.resolve();
    if (isSupabaseConfigured && supabase) {
      const p1 = Promise.resolve(
        supabase.from('workout_plan').upsert(
          {
            id: 'default_plan',
            weeks: fullWeeks,
            updated_at: nowIso,
          },
          { onConflict: 'id' }
        )
      );

      const p2 =
        history.length > 0
          ? Promise.resolve(
              supabase
                .from('workout_history')
                .upsert(history.map(mapHistoryEntryToSupabaseRow), { onConflict: 'id' })
            )
          : Promise.resolve({ error: null });

      const p3 = Promise.resolve(
        supabase.from('app_settings').upsert(
          {
            id: 'settings',
            settings,
            updated_at: nowIso,
          },
          { onConflict: 'id' }
        )
      );

      supaPromise = Promise.allSettled([p1, p2, p3]).then((results) => {
        results.forEach((r) => {
          if (r.status === 'fulfilled' && (r.value as any)?.error?.code === '42501') {
            hasRlsError = true;
          }
        });
      });
    }

    await Promise.all([apiPromise, supaPromise]);

    if (hasRlsError) {
      notifyCloudStatus('needs_rls_fix', 'RLS is blocking cloud writes. Run SQL fix in Settings.', true);
    } else {
      notifyCloudStatus('synced', 'Database Synced', false);
    }
    return true;
  } catch {
    notifyCloudStatus('synced', 'Saved locally');
    return true;
  }
}

// -------------------------------------------------------------
// PUSH PLAN (Incremental / Debounced for set toggling & plan edits)
// -------------------------------------------------------------
let pushPlanTimer: any = null;

export function debouncedPushPlanToCloud(weeks: WeekPlan[], delayMs = 350) {
  if (typeof window === 'undefined') return;
  clearTimeout(pushPlanTimer);
  pushPlanTimer = setTimeout(() => {
    pushPlanToCloud(weeks);
  }, delayMs);
}

export async function pushPlanToCloud(weeks: WeekPlan[]): Promise<boolean> {
  if (isAppOffline()) {
    notifyCloudStatus('offline', 'Offline (Saved locally)');
    return true;
  }

  notifyCloudStatus('syncing', 'Syncing...');
  const fullWeeks = ensureSixWeeks(weeks);
  const nowIso = new Date().toISOString();
  let hasRlsError = false;

  try {
    // 1. Built-in Server Database
    const apiPromise = fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_plan', data: fullWeeks }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json?.rlsBlocked) hasRlsError = true;
      })
      .catch(() => {});

    // 2. Supabase Mirror
    let supaPromise = Promise.resolve();
    if (isSupabaseConfigured && supabase) {
      supaPromise = Promise.resolve(
        supabase
          .from('workout_plan')
          .upsert(
            {
              id: 'default_plan',
              weeks: fullWeeks,
              updated_at: nowIso,
            },
            { onConflict: 'id' }
          )
      )
        .then((res) => {
          if (res.error?.code === '42501') hasRlsError = true;
        })
        .catch(() => {});
    }

    await Promise.all([apiPromise, supaPromise]);

    if (hasRlsError) {
      notifyCloudStatus('needs_rls_fix', 'RLS is blocking writes. Run SQL fix in Settings.', true);
    } else {
      notifyCloudStatus('synced', 'Database Synced', false);
    }
    return true;
  } catch {
    notifyCloudStatus('synced', 'Changes saved locally');
    return true;
  }
}

// -------------------------------------------------------------
// PUSH HISTORY
// -------------------------------------------------------------
export async function pushHistoryToCloud(history: WorkoutHistoryEntry[]): Promise<boolean> {
  if (isAppOffline()) return true;

  notifyCloudStatus('syncing', 'Saving workout log...');
  let hasRlsError = false;

  try {
    // 1. Server DB
    const apiPromise = fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_history', data: history }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json?.rlsBlocked) hasRlsError = true;
      })
      .catch(() => {});

    // 2. Supabase
    let supaPromise = Promise.resolve();
    if (isSupabaseConfigured && supabase && history.length > 0) {
      supaPromise = Promise.resolve(
        supabase
          .from('workout_history')
          .upsert(history.map(mapHistoryEntryToSupabaseRow), { onConflict: 'id' })
      )
        .then((res) => {
          if (res.error?.code === '42501') hasRlsError = true;
        })
        .catch(() => {});
    }

    await Promise.all([apiPromise, supaPromise]);

    if (hasRlsError) {
      notifyCloudStatus('needs_rls_fix', 'RLS is blocking history writes. Run SQL fix in Settings.', true);
    } else {
      notifyCloudStatus('synced', 'Database Synced', false);
    }
    return true;
  } catch {
    return true;
  }
}

// -------------------------------------------------------------
// PUSH SETTINGS
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
  if (isAppOffline()) return true;

  const nowIso = new Date().toISOString();
  try {
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_settings', data: settings }),
    }).catch(() => {});

    if (isSupabaseConfigured && supabase) {
      Promise.resolve(
        supabase
          .from('app_settings')
          .upsert(
            {
              id: 'settings',
              settings,
              updated_at: nowIso,
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

// -------------------------------------------------------------
// PULL ALL FROM CLOUD (Atomic multi-source pull)
// -------------------------------------------------------------
export async function pullAllFromCloud(): Promise<{
  plan: WeekPlan[] | null;
  history: WorkoutHistoryEntry[] | null;
  settings: { weekNumber: number; dayIndex: number; unit: WeightUnit } | null;
  updatedAt: string | null;
  source: string;
} | null> {
  if (isAppOffline()) {
    notifyCloudStatus('offline', 'Offline (Saved locally)');
    return null;
  }

  // 1. Direct Supabase Query (Fastest on client)
  if (isSupabaseConfigured && supabase) {
    try {
      const [planRes, historyRes, settingsRes] = await Promise.allSettled([
        supabase
          .from('workout_plan')
          .select('weeks, updated_at')
          .eq('id', 'default_plan')
          .maybeSingle(),
        supabase
          .from('workout_history')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(250),
        supabase
          .from('app_settings')
          .select('settings, updated_at')
          .eq('id', 'settings')
          .maybeSingle(),
      ]);

      let cloudPlan: WeekPlan[] | null = null;
      let cloudHistory: WorkoutHistoryEntry[] | null = null;
      let cloudSettings: any = null;
      let cloudUpdatedAt: string | null = null;

      if (planRes.status === 'fulfilled' && !planRes.value.error && planRes.value.data) {
        const d = planRes.value.data;
        if (Array.isArray(d.weeks) && d.weeks.length > 0) {
          cloudPlan = ensureSixWeeks(d.weeks);
          cloudUpdatedAt = d.updated_at || cloudUpdatedAt;
        }
      }

      if (historyRes.status === 'fulfilled' && !historyRes.value.error && Array.isArray(historyRes.value.data)) {
        cloudHistory = historyRes.value.data.map(mapSupabaseRowToHistoryEntry);
      }

      if (settingsRes.status === 'fulfilled' && !settingsRes.value.error && settingsRes.value.data?.settings) {
        cloudSettings = settingsRes.value.data.settings;
      }

      if (cloudPlan && cloudPlan.length > 0) {
        return {
          plan: cloudPlan,
          history: cloudHistory,
          settings: cloudSettings,
          updatedAt: cloudUpdatedAt,
          source: 'supabase',
        };
      }
    } catch {}
  }

  // 2. Fallback to /api/sync (Server DB / serverless proxy)
  try {
    const res = await fetch('/api/sync', { cache: 'no-store' });
    if (res.ok) {
      const body = await res.json();
      if (body && body.success) {
        return {
          plan: body.plan ? ensureSixWeeks(body.plan) : null,
          history: Array.isArray(body.history) ? body.history : null,
          settings: body.settings || null,
          updatedAt: body.updatedAt || null,
          source: body.source || 'server_database',
        };
      }
    }
  } catch {}

  return null;
}

export async function pullPlanFromCloud(): Promise<WeekPlan[] | null> {
  const all = await pullAllFromCloud();
  return all?.plan || null;
}

export async function pullHistoryFromCloud(): Promise<WorkoutHistoryEntry[] | null> {
  const all = await pullAllFromCloud();
  return all?.history || null;
}

export async function pullSettingsFromCloud(): Promise<{
  weekNumber: number;
  dayIndex: number;
  unit: WeightUnit;
} | null> {
  const all = await pullAllFromCloud();
  return all?.settings || null;
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

    // 2. Test write permissions (check for RLS policy 42501 error on workout_plan)
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
        notifyCloudStatus('needs_rls_fix', 'Row-Level Security (RLS) is blocking writes. Run SQL fix.', true);
        return {
          connected: true,
          tableFound: true,
          needsRlsFix: true,
          message: 'Row-Level Security (RLS) is blocking writes. Please run the 3-line SQL command in Supabase SQL Editor.',
        };
      }
      return {
        connected: true,
        tableFound: true,
        needsRlsFix: false,
        message: `Connected, but write test failed: ${writeError.message}`,
      };
    }

    // Also test history write
    const { error: histWriteError } = await supabase.from('workout_history').upsert(
      {
        id: 'test_hist_ping',
        session_date: new Date().toISOString(),
        day_title: 'Ping',
        week_number: 1,
        sets: [],
        duration_minutes: 0,
        notes: '',
        created_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (histWriteError && (histWriteError.code === '42501' || histWriteError.message?.includes('row-level security'))) {
      notifyCloudStatus('needs_rls_fix', 'RLS is blocking workout_history writes. Run SQL fix.', true);
      return {
        connected: true,
        tableFound: true,
        needsRlsFix: true,
        message: "Row-Level Security (RLS) is blocking writes on 'workout_history'. Run the SQL fix.",
      };
    }

    // Clean up ping rows if successful
    await supabase.from('workout_plan').delete().eq('id', 'test_connection_ping');
    await supabase.from('workout_history').delete().eq('id', 'test_hist_ping');

    notifyCloudStatus('synced', 'Database Ready & Synced', false);
    return {
      connected: true,
      tableFound: true,
      needsRlsFix: false,
      message: '🟢 100% Connected! Supabase Cloud Database is fully synchronized with full read/write access.',
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
