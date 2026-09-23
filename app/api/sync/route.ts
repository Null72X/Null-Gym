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

// Ensure data folder and file exist once on startup
let isLoadedFromDisk = false;

function ensureLoaded() {
  if (isLoadedFromDisk) return inMemoryDatabase;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      inMemoryDatabase = { ...inMemoryDatabase, ...parsed };
    } else {
      fs.writeFileSync(DATA_FILE, JSON.stringify(inMemoryDatabase), 'utf-8');
    }
  } catch (err) {
    // If running in a read-only container/serverless, fallback to inMemory
  }
  isLoadedFromDisk = true;
  return inMemoryDatabase;
}

let savePromise: Promise<any> | null = null;
let pendingSaveTimeout: any = null;

function saveDatabaseAsync(data: Partial<typeof inMemoryDatabase>) {
  inMemoryDatabase = {
    ...inMemoryDatabase,
    ...data,
    updatedAt: new Date().toISOString(),
  };

  // Debounced non-blocking async file write
  if (pendingSaveTimeout) clearTimeout(pendingSaveTimeout);
  pendingSaveTimeout = setTimeout(() => {
    try {
      const payload = JSON.stringify(inMemoryDatabase);
      fs.promises.mkdir(DATA_DIR, { recursive: true })
        .then(() => fs.promises.writeFile(DATA_FILE, payload, 'utf-8'))
        .catch(() => {});
    } catch {}
  }, 100);

  return inMemoryDatabase;
}

import { ensureSixWeeks } from '@/lib/planDefaults';

// GET /api/sync -> Returns current database snapshot
export async function GET() {
  const db = ensureLoaded();
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
    const db = ensureLoaded();

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

    saveDatabaseAsync(db);

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
