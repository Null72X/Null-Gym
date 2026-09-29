'use client';

import { isAppOffline } from './offlineManager';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { WeekPlan, WorkoutHistoryEntry, WeightUnit } from '../types/workout';
import { ensureSixWeeks } from './planDefaults';
import { mapHistoryEntryToSupabaseRow } from './supabaseSync';

export interface OutboxItem {
  id: string;
  action: 'save_plan' | 'save_history' | 'save_settings' | 'save_all';
  data: any;
  timestamp: number;
  retryCount: number;
}

const OUTBOX_STORAGE_KEY = 'nullgym_outbox_queue_v1';
let memoryQueue: OutboxItem[] | null = null;
let isFlushing = false;

type OutboxListener = (count: number) => void;
const outboxListeners: Set<OutboxListener> = new Set();

export function onOutboxCountChange(listener: OutboxListener): () => void {
  outboxListeners.add(listener);
  listener(getPendingOutboxCount());
  return () => {
    outboxListeners.delete(listener);
  };
}

function notifyCount() {
  const count = getPendingOutboxCount();
  outboxListeners.forEach((l) => l(count));
}

export function getOutboxQueue(): OutboxItem[] {
  if (memoryQueue !== null) return memoryQueue;
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
    if (!raw) {
      memoryQueue = [];
      return [];
    }
    const parsed = JSON.parse(raw);
    memoryQueue = Array.isArray(parsed) ? parsed : [];
    return memoryQueue;
  } catch {
    memoryQueue = [];
    return [];
  }
}

function saveOutboxQueue(queue: OutboxItem[]) {
  memoryQueue = queue;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(queue));
  } catch {}
  notifyCount();
}

export function getPendingOutboxCount(): number {
  return getOutboxQueue().length;
}

/**
 * Enqueue a sync action with smart coalescing (merges duplicate plan/settings actions)
 */
export function enqueueOutboxItem(action: OutboxItem['action'], data: any) {
  const queue = [...getOutboxQueue()];
  const now = Date.now();

  // Smart coalescing: If a pending save_plan already exists, replace it with the newer plan
  if (action === 'save_plan') {
    const idx = queue.findIndex((item) => item.action === 'save_plan');
    if (idx !== -1) {
      queue[idx] = { id: queue[idx].id, action: 'save_plan', data, timestamp: now, retryCount: 0 };
      saveOutboxQueue(queue);
      requestBackgroundSync();
      return;
    }
  }

  // If a pending save_settings already exists, replace it
  if (action === 'save_settings') {
    const idx = queue.findIndex((item) => item.action === 'save_settings');
    if (idx !== -1) {
      queue[idx] = { id: queue[idx].id, action: 'save_settings', data, timestamp: now, retryCount: 0 };
      saveOutboxQueue(queue);
      requestBackgroundSync();
      return;
    }
  }

  // If save_all, it supersedes standalone plan/settings
  if (action === 'save_all') {
    const filtered = queue.filter((item) => item.action !== 'save_plan' && item.action !== 'save_settings');
    filtered.push({
      id: `outbox_${now}_${Math.random().toString(36).slice(2, 6)}`,
      action: 'save_all',
      data,
      timestamp: now,
      retryCount: 0,
    });
    saveOutboxQueue(filtered);
    requestBackgroundSync();
    return;
  }

  queue.push({
    id: `outbox_${now}_${Math.random().toString(36).slice(2, 6)}`,
    action,
    data,
    timestamp: now,
    retryCount: 0,
  });

  saveOutboxQueue(queue);
  requestBackgroundSync();
}

/**
 * Request PWA Native Background Sync if supported
 */
function requestBackgroundSync() {
  if (typeof window === 'undefined') return;
  if ('serviceWorker' in navigator && 'SyncManager' in (window as any)) {
    navigator.serviceWorker.ready
      .then((reg: any) => {
        if (reg.sync) {
          reg.sync.register('sync-workouts').catch(() => {});
        }
      })
      .catch(() => {});
  }
}

/**
 * Flush all pending outbox items to both Server and Supabase
 */
export async function flushOutboxQueue(): Promise<boolean> {
  if (typeof window === 'undefined' || isFlushing || isAppOffline()) return false;

  const queue = getOutboxQueue();
  if (queue.length === 0) return true;

  isFlushing = true;
  const nowIso = new Date().toISOString();
  const remaining: OutboxItem[] = [];

  for (const item of queue) {
    try {
      let succeeded = false;

      // 1. Send to server /api/sync
      const apiRes = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: item.action, data: item.data }),
      }).catch(() => null);

      if (apiRes && apiRes.ok) {
        succeeded = true;
      }

      // 2. Also send to Supabase if configured
      if (isSupabaseConfigured && supabase) {
        if (item.action === 'save_plan' && Array.isArray(item.data)) {
          await supabase.from('workout_plan').upsert(
            { id: 'default_plan', weeks: ensureSixWeeks(item.data), updated_at: nowIso },
            { onConflict: 'id' }
          );
        } else if (item.action === 'save_history' && Array.isArray(item.data) && item.data.length > 0) {
          await supabase
            .from('workout_history')
            .upsert(item.data.map(mapHistoryEntryToSupabaseRow), { onConflict: 'id' });
        } else if (item.action === 'save_settings' && item.data) {
          await supabase.from('app_settings').upsert(
            { id: 'settings', settings: item.data, updated_at: nowIso },
            { onConflict: 'id' }
          );
        } else if (item.action === 'save_all' && item.data) {
          const promises = [];
          if (item.data.plan) {
            promises.push(
              supabase.from('workout_plan').upsert(
                { id: 'default_plan', weeks: ensureSixWeeks(item.data.plan), updated_at: nowIso },
                { onConflict: 'id' }
              )
            );
          }
          if (Array.isArray(item.data.history) && item.data.history.length > 0) {
            promises.push(
              supabase
                .from('workout_history')
                .upsert(item.data.history.map(mapHistoryEntryToSupabaseRow), { onConflict: 'id' })
            );
          }
          if (item.data.settings) {
            promises.push(
              supabase.from('app_settings').upsert(
                { id: 'settings', settings: item.data.settings, updated_at: nowIso },
                { onConflict: 'id' }
              )
            );
          }
          await Promise.allSettled(promises);
        }
      }

      if (!succeeded && isAppOffline()) {
        item.retryCount += 1;
        remaining.push(item);
      }
    } catch {
      item.retryCount += 1;
      remaining.push(item);
    }
  }

  saveOutboxQueue(remaining);
  isFlushing = false;
  return remaining.length === 0;
}

// Background event handlers to auto-flush whenever connectivity is restored
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushOutboxQueue();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      flushOutboxQueue();
    }
  });

  window.addEventListener('focus', () => {
    flushOutboxQueue();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'FLUSH_OUTBOX') {
        flushOutboxQueue();
      }
    });
  }
}
