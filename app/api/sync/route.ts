import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { WeekPlan, WorkoutHistoryEntry, WeightUnit } from '@/types/workout';
import { ensureSixWeeks } from '@/lib/planDefaults';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

// In-memory database store
let inMemoryDatabase: {
  plan: WeekPlan[] | null;
  history: WorkoutHistoryEntry[];
  settings: { weekNumber: number; dayIndex: number; unit: WeightUnit };
  updatedAt: string;
} = {
  plan: null,
  history: [],
  settings: { weekNumber: 1, dayIndex: 0, unit: 'kg' },
  updatedAt: new Date().toISOString(),
};

// Data file paths: primary (project data dir) with /tmp fallback for serverless (Vercel)
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'gym_database.json');
const TMP_FILE = path.join('/tmp', 'gym_database.json');

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

  // Attempt 1: Write to process.cwd()/data
  try {
    if (!fs.existsSync(DATA_DIR)) {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
    }
    await fs.promises.writeFile(DATA_FILE, payload, 'utf-8');
  } catch {
    // Attempt 2: Write to /tmp for serverless environments (Vercel)
    try {
      await fs.promises.writeFile(TMP_FILE, payload, 'utf-8');
    } catch {}
  }

  return inMemoryDatabase;
}

// GET /api/sync -> 100% Automatic Cloud & Server Database Pull
export async function GET() {
  try {
    // 1. If Supabase is configured, try querying the cloud database first
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('workout_plan')
          .select('weeks, updated_at')
          .eq('id', 'default_plan')
          .maybeSingle();

        if (!error && data && Array.isArray(data.weeks) && data.weeks.length > 0) {
          const validPlan = ensureSixWeeks(data.weeks);
          return NextResponse.json({
            success: true,
            plan: validPlan,
            history: inMemoryDatabase.history || [],
            settings: inMemoryDatabase.settings || { weekNumber: 1, dayIndex: 0, unit: 'kg' },
            updatedAt: data.updated_at || inMemoryDatabase.updatedAt,
            source: 'supabase',
          });
        }
      } catch {}
    }

    // 2. Fallback to server local/tmp database
    const db = loadDatabaseFromDisk();
    const validPlan = db.plan ? ensureSixWeeks(db.plan) : null;

    return NextResponse.json({
      success: true,
      plan: validPlan,
      history: db.history || [],
      settings: db.settings || { weekNumber: 1, dayIndex: 0, unit: 'kg' },
      updatedAt: db.updatedAt,
      source: 'server_database',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch sync state' },
      { status: 500 }
    );
  }
}

// POST /api/sync -> 100% Automatic Background Save
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, data } = body;

    const db = loadDatabaseFromDisk();

    if (action === 'save_plan' && Array.isArray(data)) {
      db.plan = ensureSixWeeks(data);
    } else if (action === 'save_history' && Array.isArray(data)) {
      db.history = data;
    } else if (action === 'save_settings' && data) {
      db.settings = { ...db.settings, ...data };
    } else if (action === 'save_all' && data) {
      if (data.plan) db.plan = ensureSixWeeks(data.plan);
      if (data.history) db.history = data.history;
      if (data.settings) db.settings = data.settings;
    }

    await persistDatabase(db);

    // Also mirror to Supabase asynchronously from server if configured
    if (isSupabaseConfigured && supabase) {
      if (action === 'save_plan' || (action === 'save_all' && data?.plan)) {
        const planToSave = action === 'save_plan' ? data : data.plan;
        Promise.resolve(
          supabase
            .from('workout_plan')
            .upsert(
              {
                id: 'default_plan',
                weeks: ensureSixWeeks(planToSave),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id' }
            )
        ).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      updatedAt: inMemoryDatabase.updatedAt,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Sync failed' },
      { status: 500 }
    );
  }
}
