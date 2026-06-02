/**
 * Orchestrates Google Health data synchronisation (E7-11, E7-13, E7-17, E7-18, E7-19).
 *
 * Strategy:
 *  - First sync: last 90 days.
 *  - Subsequent syncs: from lastSyncAt (or 7-day window if that fails).
 *  - On network error: silently skip, keep stale data (E7-17).
 *  - On 403: record 'scope_denied' error (E7-18).
 *  - After 7+ consecutive failing days: set flag for UI warning (E7-19).
 */

import { db, type GoogleHealthDay } from '../../../db/index';
import { fetchSleepData, fetchStepsData, fetchRhrData } from './googleFitApi';

const INITIAL_SYNC_DAYS = 90;
const FAIL_DAY_THRESHOLD = 7; // E7-19

/** Perform a full or incremental sync. Safe to call on app open. */
export async function syncGoogleHealth(): Promise<void> {
  const conn = await db.googleHealthConnection.get(1);
  if (!conn) return; // not connected

  const now = Date.now();
  const startMs = conn.lastSyncAt
    ? conn.lastSyncAt.getTime() - 24 * 60 * 60 * 1000 // overlap 1 day to catch late updates
    : now - INITIAL_SYNC_DAYS * 24 * 60 * 60 * 1000;

  try {
    const [sleep, steps, rhr] = await Promise.all([
      fetchSleepData(startMs, now),
      fetchStepsData(startMs, now),
      fetchRhrData(startMs, now),
    ]);

    // Merge all data into a date-keyed map
    const dayMap = new Map<string, Partial<GoogleHealthDay>>();

    for (const s of sleep) {
      const d = dayMap.get(s.date) ?? {};
      d.sleepMinutes = s.sleepMinutes;
      d.sleepPhases = s.sleepPhases;
      dayMap.set(s.date, d);
    }
    for (const s of steps) {
      const d = dayMap.get(s.date) ?? {};
      d.steps = s.steps;
      dayMap.set(s.date, d);
    }
    for (const r of rhr) {
      const d = dayMap.get(r.date) ?? {};
      d.restingHeartRate = r.bpm;
      dayMap.set(r.date, d);
    }

    // Upsert into googleHealthData (merge with existing rows for the same date)
    await db.transaction('rw', db.googleHealthData, db.googleHealthConnection, async () => {
      for (const [date, partial] of dayMap) {
        const existing = await db.googleHealthData.where('date').equals(date).first();
        const syncedAt = new Date();

        if (existing) {
          await db.googleHealthData.update(existing.id!, {
            sleepMinutes: partial.sleepMinutes ?? existing.sleepMinutes,
            sleepPhases: partial.sleepPhases ?? existing.sleepPhases,
            steps: partial.steps ?? existing.steps,
            restingHeartRate: partial.restingHeartRate ?? existing.restingHeartRate,
            syncedAt,
          });
        } else {
          await db.googleHealthData.add({
            date,
            sleepMinutes: partial.sleepMinutes ?? null,
            sleepPhases: partial.sleepPhases ?? null,
            steps: partial.steps ?? null,
            restingHeartRate: partial.restingHeartRate ?? null,
            syncedAt,
          });
        }
      }

      // Record successful sync
      await db.googleHealthConnection.put({
        ...conn,
        lastSyncAt: new Date(),
        lastSyncError: null,
        consecutiveFailDays: 0,
      });
    });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    const errorKey = status === 403 ? 'scope_denied' : 'network_error';

    // Calculate how many consecutive days without a successful sync
    const daysSinceSync = conn.lastSyncAt
      ? Math.floor((Date.now() - conn.lastSyncAt.getTime()) / 86_400_000)
      : FAIL_DAY_THRESHOLD + 1;

    await db.googleHealthConnection.put({
      ...conn,
      lastSyncError: errorKey,
      consecutiveFailDays: Math.max(conn.consecutiveFailDays, daysSinceSync),
    });

    // E7-17: on network error, swallow — app stays usable
    if (errorKey === 'network_error') return;

    // E7-18: propagate scope_denied so UI can surface it
    throw err;
  }
}

/** Wipe all Google Health tokens and synced data (E7-10, E7-21). */
export async function disconnectGoogleHealth(): Promise<void> {
  await db.transaction('rw', [db.googleHealthConnection, db.googleHealthData], async () => {
    await db.googleHealthConnection.clear();
    await db.googleHealthData.clear();
  });
}
