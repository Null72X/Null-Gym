import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { WeekPlan, WorkoutHistoryEntry, WeightUnit } from '@/types/workout';
import { ensureSixWeeks } from '@/lib/planDefaults';
import { supabaseServer, isSupabaseConfigured } from '@/lib/supabaseClient';

// In-memory database store
let inMemoryDatabase: {
  users?: Record<
    string,
    {
      plan: WeekPlan[] | null;
      history: WorkoutHistoryEntry[];
      settings: { weekNumber: number; dayIndex: number; unit: WeightUnit };
      updatedAt: string;
    }
  >;
  plan: WeekPlan[] | null;
  history: WorkoutHistoryEntry[];
  settings: { weekNumber: number; dayIndex: number; unit: WeightUnit };
  updatedAt: string;
} = {
  users: {},
  plan: null,
  history: [],
  settings: { weekNumber: 1, dayIndex: 0, unit: 'kg' },
  updatedAt: new Date().toISOString(),
};

// Data file paths: primary (project data dir) with /tmp fallback for serverless (Vercel)
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'gym_database.json');
const TMP_FILE = path.join('/tmp', 'gym_database.json');

function mapSupabaseRowToHistoryEntry(row: any): WorkoutHistoryEntry {
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

function mapHistoryEntryToSupabaseRow(entry: WorkoutHistoryEntry, userId: string) {
  return {
    id: entry.id,
    session_date: entry.date,
    day_title: entry.workoutTitle,
    week_number: entry.weekNumber,
    sets: {
      userId,
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

function loadDatabaseFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      inMemoryDatabase = { ...inMemoryDatabase, ...parsed };
      return inMemoryDatabase;
    }
  } catch {}

  try {
    if (fs.existsSync(TMP_FILE)) {
      const content = fs.readFileSync(TMP_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      inMemoryDatabase = { ...inMemoryDatabase, ...parsed };
      return inMemoryDatabase;
    }
  } catch {}

  return inMemoryDatabase;
}

async function persistDatabase(data: Partial<typeof inMemoryDatabase>) {
  inMemoryDatabase = {
    ...inMemoryDatabase,
    ...data,
    updatedAt: new Date().toISOString(),
  };

  const payload = JSON.stringify(inMemoryDatabase, null, 2);

  try {
    if (!fs.existsSync(DATA_DIR)) {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
    }
    await fs.promises.writeFile(DATA_FILE, payload, 'utf-8');
  } catch {
    try {
      await fs.promises.writeFile(TMP_FILE, payload, 'utf-8');
    } catch {}
  }

  return inMemoryDatabase;
}

/**
 * Strict server-side Bearer token authentication check
 */
async function authenticateRequest(request: Request): Promise<{ id: string; email?: string } | null> {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) return null;

  if (isSupabaseConfigured && supabaseServer) {
    try {
      const {
        data: { user },
        error,
      } = await supabaseServer.auth.getUser(token);
      if (error || !user) {
        return null;
      }
      return { id: user.id, email: user.email };
    } catch (err) {
      console.error('[API Auth] Error verifying token:', err);
      return null;
    }
  }

  return null;
}

// GET /api/sync -> Authenticated Cloud & Server Database Pull
export async function GET(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      );
    }

    const userId = authUser.id;
    const planId = `plan_${userId}`;
    const settingsId = `settings_${userId}`;

    let cloudPlan: WeekPlan[] | null = null;
    let cloudHistory: WorkoutHistoryEntry[] | null = null;
    let cloudSettings: { weekNumber: number; dayIndex: number; unit: WeightUnit } | null = null;
    let cloudUpdatedAt: string | null = null;

    // 1. Query Supabase Cloud Database scoped strictly to verified userId
    if (isSupabaseConfigured && supabaseServer) {
      try {
        const histQuery = supabaseServer
          .from('workout_history')
          .select('*')
          .filter('sets->>userId', 'eq', userId)
          .order('created_at', { ascending: false })
          .limit(250);

        const [planRes, historyRes, settingsRes] = await Promise.allSettled([
          supabaseServer
            .from('workout_plan')
            .select('weeks, updated_at')
            .eq('id', planId)
            .maybeSingle(),
          histQuery,
          supabaseServer
            .from('app_settings')
            .select('settings, updated_at')
            .eq('id', settingsId)
            .maybeSingle(),
        ]);

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
          return NextResponse.json({
            success: true,
            plan: cloudPlan,
            history: cloudHistory || [],
            settings: cloudSettings || { weekNumber: 1, dayIndex: 0, unit: 'kg' },
            updatedAt: cloudUpdatedAt || new Date().toISOString(),
            source: 'supabase',
          });
        }
      } catch (supaErr) {
        console.error('[API /api/sync] Supabase query error:', supaErr);
      }
    }

    // 2. Fallback to server local/tmp database scoped strictly to verified userId
    const db = loadDatabaseFromDisk();
    const userDb = db.users?.[userId] || {
      plan: null,
      history: [],
      settings: { weekNumber: 1, dayIndex: 0, unit: 'kg' as WeightUnit },
      updatedAt: new Date().toISOString(),
    };
    const validPlan = userDb.plan ? ensureSixWeeks(userDb.plan) : null;

    return NextResponse.json({
      success: true,
      plan: validPlan,
      history: userDb.history || [],
      settings: userDb.settings || { weekNumber: 1, dayIndex: 0, unit: 'kg' },
      updatedAt: userDb.updatedAt || db.updatedAt,
      source: 'server_database',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch sync state' },
      { status: 500 }
    );
  }
}

// POST /api/sync -> Authenticated Background Save
export async function POST(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, data } = body;
    const userId = authUser.id;
    const planId = `plan_${userId}`;
    const settingsId = `settings_${userId}`;
    const nowIso = new Date().toISOString();

    const db = loadDatabaseFromDisk();
    let rlsBlocked = false;

    if (!db.users) db.users = {};
    if (!db.users[userId]) {
      db.users[userId] = {
        plan: null,
        history: [],
        settings: { weekNumber: 1, dayIndex: 0, unit: 'kg' },
        updatedAt: nowIso,
      };
    }
    const target = db.users[userId];

    if (action === 'save_plan' && Array.isArray(data)) {
      target.plan = ensureSixWeeks(data);
    } else if (action === 'save_history' && Array.isArray(data)) {
      target.history = data;
    } else if (action === 'save_settings' && data) {
      target.settings = { ...target.settings, ...data };
    } else if (action === 'save_all' && data) {
      if (data.plan) target.plan = ensureSixWeeks(data.plan);
      if (data.history) target.history = data.history;
      if (data.settings) target.settings = data.settings;
    }
    target.updatedAt = nowIso;

    await persistDatabase(db);

    // Mirror to Supabase with verified userId
    if (isSupabaseConfigured && supabaseServer) {
      try {
        if (action === 'save_plan' || (action === 'save_all' && data?.plan)) {
          const planToSave = action === 'save_plan' ? data : data.plan;
          const res = await supabaseServer.from('workout_plan').upsert(
            {
              id: planId,
              weeks: ensureSixWeeks(planToSave),
              updated_at: nowIso,
            },
            { onConflict: 'id' }
          );
          if (res?.error?.code === '42501') rlsBlocked = true;
        }

        if (action === 'save_history' || (action === 'save_all' && data?.history)) {
          const historyToSave: WorkoutHistoryEntry[] = action === 'save_history' ? data : data.history;
          if (Array.isArray(historyToSave) && historyToSave.length > 0) {
            const rows = historyToSave.map((h) => mapHistoryEntryToSupabaseRow(h, userId));
            const res = await supabaseServer.from('workout_history').upsert(rows, { onConflict: 'id' });
            if (res?.error?.code === '42501') rlsBlocked = true;
          }
        }

        if (action === 'save_settings' || (action === 'save_all' && data?.settings)) {
          const settingsToSave = action === 'save_settings' ? data : data.settings;
          const res = await supabaseServer.from('app_settings').upsert(
            {
              id: settingsId,
              settings: settingsToSave,
              updated_at: nowIso,
            },
            { onConflict: 'id' }
          );
          if (res?.error?.code === '42501') rlsBlocked = true;
        }
      } catch (err: any) {
        if (err?.code === '42501' || err?.message?.includes('row-level security')) {
          rlsBlocked = true;
        }
      }
    }

    return NextResponse.json({
      success: true,
      rlsBlocked,
      updatedAt: target.updatedAt,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Sync failed' },
      { status: 500 }
    );
  }
}
