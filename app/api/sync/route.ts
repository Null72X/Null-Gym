import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { WeekPlan, WorkoutHistoryEntry, WeightUnit } from '@/types/workout';

// In-memory fallback if disk is read-only (e.g. serverless)
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

// Data file path on server
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'gym_database.json');

// Ensure data folder and file exist
function getDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      inMemoryDatabase = { ...inMemoryDatabase, ...parsed };
      return inMemoryDatabase;
    } else {
      fs.writeFileSync(DATA_FILE, JSON.stringify(inMemoryDatabase, null, 2), 'utf-8');
      return inMemoryDatabase;
    }
  } catch (err) {
    // If running in a read-only container/serverless, fallback to inMemory
    return inMemoryDatabase;
  }
}

function saveDatabase(data: typeof inMemoryDatabase) {
  inMemoryDatabase = {
    ...inMemoryDatabase,
    ...data,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(inMemoryDatabase, null, 2), 'utf-8');
    return true;
  } catch (err) {
    // Read-only filesystem fallback
    return true;
  }
}

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

function ensureSixWeeks(plan: WeekPlan[] | null): WeekPlan[] {
  if (!plan || !Array.isArray(plan)) {
    return Array.from({ length: 6 }, (_, wIdx) => ({
      weekNumber: wIdx + 1,
      days: DAY_NAMES.map((d, dIdx) => ({
        id: `w${wIdx + 1}_d${dIdx}`,
        dayOfWeek: d,
        title: d === 'Sunday' ? 'Rest Day' : d,
        focus: d === 'Sunday' ? 'Rest & Recovery' : '',
        isRestDay: d === 'Sunday',
        exercises: [],
      })),
    }));
  }

  if (plan.length >= 6) return plan;

  const extraWeeks: WeekPlan[] = Array.from({ length: 6 - plan.length }, (_, idx) => {
    const wNum = plan.length + idx + 1;
    return {
      weekNumber: wNum,
      days: DAY_NAMES.map((d, dIdx) => ({
        id: `w${wNum}_d${dIdx}`,
        dayOfWeek: d,
        title: d === 'Sunday' ? 'Rest Day' : d,
        focus: d === 'Sunday' ? 'Rest & Recovery' : '',
        isRestDay: d === 'Sunday',
        exercises: [],
      })),
    };
  });

  return [...plan, ...extraWeeks];
}

// GET /api/sync -> Returns current database snapshot
export async function GET() {
  const db = getDatabase();
  const validPlan = db.plan ? ensureSixWeeks(db.plan) : null;
  return NextResponse.json({
    success: true,
    plan: validPlan,
    history: db.history || [],
    settings: db.settings || { weekNumber: 1, dayIndex: 0, unit: 'kg' },
    updatedAt: db.updatedAt,
  });
}

// POST /api/sync -> Persists updates automatically
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, data } = body;
    const db = getDatabase();

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

    saveDatabase(db);

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
