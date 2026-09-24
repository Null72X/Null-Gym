import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { WeekPlan, WorkoutHistoryEntry, WeightUnit } from '@/types/workout';
import { ensureSixWeeks } from '@/lib/planDefaults';

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

// In-memory 6-digit Device Sync Tokens (Valid for 2 hours)
// Enables instant PC -> Mobile QR Code & PIN Transfer
interface SyncTokenData {
  payload: any;
  createdAt: number;
}
const syncTokens = new Map<string, SyncTokenData>();

// Cleanup expired tokens every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, item] of syncTokens.entries()) {
    if (now - item.createdAt > 2 * 60 * 60 * 1000) {
      syncTokens.delete(code);
    }
  }
}, 30 * 60 * 1000);

// Data file path on server
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'gym_database.json');

function loadDatabaseFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      inMemoryDatabase = { ...inMemoryDatabase, ...parsed };
    }
  } catch (err) {
    // Read failure or serverless ephemeral filesystem - fallback to in-memory
  }
  return inMemoryDatabase;
}

async function persistDatabase(data: Partial<typeof inMemoryDatabase>) {
  inMemoryDatabase = {
    ...inMemoryDatabase,
    ...data,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (!fs.existsSync(DATA_DIR)) {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
    }
    const payload = JSON.stringify(inMemoryDatabase, null, 2);
    await fs.promises.writeFile(DATA_FILE, payload, 'utf-8');
  } catch (err) {
    // If running in a read-only container/serverless, in-memory state is preserved
  }

  return inMemoryDatabase;
}

// GET /api/sync
// Supports normal database pull OR direct 6-digit sync token redemption (?code=XXXXXX)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code') || searchParams.get('token');

    // Case 1: Redeem a 6-digit device sync token from PC
    if (code) {
      const cleanCode = code.trim().replace(/\s+/g, '');
      const tokenItem = syncTokens.get(cleanCode);

      if (!tokenItem) {
        return NextResponse.json(
          { success: false, error: 'Invalid or expired sync code. Please generate a new code on your PC.' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        isTokenRedemption: true,
        payload: tokenItem.payload,
      });
    }

    // Case 2: Standard database pull
    const db = loadDatabaseFromDisk();
    const validPlan = db.plan ? ensureSixWeeks(db.plan) : null;

    return NextResponse.json({
      success: true,
      plan: validPlan,
      history: db.history || [],
      settings: db.settings || { weekNumber: 1, dayIndex: 0, unit: 'kg' },
      updatedAt: db.updatedAt,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch sync state' },
      { status: 500 }
    );
  }
}

// POST /api/sync -> Persists updates or generates instant device sync tokens
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, data } = body;

    // Case 1: Create a 6-digit Device Sync Token (PC -> Mobile QR Code)
    if (action === 'create_sync_token' && data) {
      // Generate a distinct 6-digit PIN
      const tokenCode = Math.floor(100000 + Math.random() * 900000).toString();
      syncTokens.set(tokenCode, {
        payload: data,
        createdAt: Date.now(),
      });

      return NextResponse.json({
        success: true,
        code: tokenCode,
        expiresIn: '2 hours',
      });
    }

    // Case 2: Persist database updates
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
