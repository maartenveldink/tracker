/**
 * Google Fit REST API calls for sleep, steps and resting heart rate.
 * Uses the Fitness Activity/Sleep Sessions API and the Dataset:Aggregate endpoint.
 * Reference: https://developers.google.com/fit/rest/v1/reference
 */

import type { SleepPhases } from '../../../db/index';
import { getValidAccessToken } from './oauth';

const FIT_BASE = 'https://www.googleapis.com/fitness/v1/users/me';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fitGet(path: string): Promise<unknown> {
  const token = await getValidAccessToken();
  const res = await fetch(`${FIT_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`Google Fit GET ${path} → ${res.status}`), {
      status: res.status,
      body,
    });
  }
  return res.json();
}

async function fitPost(path: string, body: unknown): Promise<unknown> {
  const token = await getValidAccessToken();
  const res = await fetch(`${FIT_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Google Fit POST ${path} → ${res.status}`), {
      status: res.status,
      body: text,
    });
  }
  return res.json();
}

function toRfc3339(ms: number): string {
  return new Date(ms).toISOString();
}

/** Format a Date as YYYY-MM-DD. */
function toYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Sleep data (E7-11, E7-12, E7-13)
// ---------------------------------------------------------------------------

interface FitSleepSession {
  startTimeMillis: string;
  endTimeMillis: string;
}

interface FitSleepPoint {
  startTimeNanos: string;
  endTimeNanos: string;
  value: { intVal?: number }[];
}

interface FitSleepSegmentResponse {
  point?: FitSleepPoint[];
}

export interface DailySleep {
  date: string; // YYYY-MM-DD (wake-up date)
  sleepMinutes: number;
  sleepPhases: SleepPhases | null;
}

/**
 * Fetch sleep data between startMs and endMs.
 * Groups sessions by wake-up date (E7-13).
 */
export async function fetchSleepData(startMs: number, endMs: number): Promise<DailySleep[]> {
  const params = new URLSearchParams({
    activityType: '72', // sleep
    startTime: toRfc3339(startMs),
    endTime: toRfc3339(endMs),
  });

  const response = await fitGet(`/sessions?${params}`) as { session?: FitSleepSession[] };
  const sessions = response.session ?? [];

  if (sessions.length === 0) return [];

  // Group sessions by wake-up date (end time date)
  const byDate = new Map<string, FitSleepSession[]>();
  for (const session of sessions) {
    const date = toYmd(Number(session.endTimeMillis));
    const group = byDate.get(date) ?? [];
    group.push(session);
    byDate.set(date, group);
  }

  // Try to fetch sleep phases for the entire range (one call)
  const phasesByDate = await fetchSleepPhases(startMs, endMs).catch(() => new Map<string, SleepPhases>());

  const results: DailySleep[] = [];
  for (const [date, dateSessions] of byDate) {
    // E7-13: sum all sessions for total duration
    const totalMinutes = dateSessions.reduce((sum, s) => {
      return sum + Math.round((Number(s.endTimeMillis) - Number(s.startTimeMillis)) / 60_000);
    }, 0);

    results.push({
      date,
      sleepMinutes: totalMinutes,
      sleepPhases: phasesByDate.get(date) ?? null,
    });
  }

  return results;
}

/**
 * Fetch sleep phase segments for the date range.
 * Returns a map of date → SleepPhases.
 * Silently returns empty map on error (phases are optional).
 */
async function fetchSleepPhases(startMs: number, endMs: number): Promise<Map<string, SleepPhases>> {
  // Sleep segment data source
  const startNs = startMs * 1_000_000;
  const endNs = endMs * 1_000_000;
  const dataSource = 'derived:com.google.sleep.segment:com.google.android.gms:merged';

  const response = await fitGet(
    `/dataSources/${encodeURIComponent(dataSource)}/datasets/${startNs}-${endNs}`,
  ) as FitSleepSegmentResponse;

  const points = response.point ?? [];
  const byDate = new Map<string, SleepPhases>();

  for (const point of points) {
    const stage = point.value[0]?.intVal ?? 0;
    const durationMinutes = Math.round(
      (Number(point.endTimeNanos) - Number(point.startTimeNanos)) / 60_000_000_000,
    );
    if (durationMinutes <= 0) continue;

    const date = toYmd(Number(point.endTimeNanos) / 1_000_000);
    const phases = byDate.get(date) ?? { lightMinutes: 0, deepMinutes: 0, remMinutes: 0, awakeMinutes: 0 };

    switch (stage) {
      case 1: phases.lightMinutes += durationMinutes; break;
      case 2: phases.deepMinutes += durationMinutes; break;
      case 3: phases.remMinutes += durationMinutes; break;
      case 4: phases.awakeMinutes += durationMinutes; break;
    }

    byDate.set(date, phases);
  }

  return byDate;
}

// ---------------------------------------------------------------------------
// Steps data (E7-14)
// ---------------------------------------------------------------------------

export interface DailySteps {
  date: string;
  steps: number;
}

export async function fetchStepsData(startMs: number, endMs: number): Promise<DailySteps[]> {
  const response = await fitPost('/dataset:aggregate', {
    aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
    bucketByTime: { durationMillis: 86_400_000 },
    startTimeMillis: startMs,
    endTimeMillis: endMs,
  }) as { bucket?: AggBucket[] };

  const results: DailySteps[] = [];
  for (const bucket of response.bucket ?? []) {
    const points = bucket.dataset?.[0]?.point ?? [];
    if (points.length === 0) continue;

    const steps = points.reduce((sum, p) => sum + (p.value?.[0]?.intVal ?? 0), 0);
    if (steps <= 0) continue;

    results.push({
      date: toYmd(Number(bucket.startTimeMillis)),
      steps,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Resting heart rate (E7-15)
// ---------------------------------------------------------------------------

export interface DailyRhr {
  date: string;
  bpm: number; // lowest measurement of the day
}

export async function fetchRhrData(startMs: number, endMs: number): Promise<DailyRhr[]> {
  const response = await fitPost('/dataset:aggregate', {
    aggregateBy: [{ dataTypeName: 'com.google.heart_rate.bpm' }],
    bucketByTime: { durationMillis: 86_400_000 },
    startTimeMillis: startMs,
    endTimeMillis: endMs,
  }) as { bucket?: AggBucket[] };

  const results: DailyRhr[] = [];
  for (const bucket of response.bucket ?? []) {
    const points = bucket.dataset?.[0]?.point ?? [];
    if (points.length === 0) continue;

    // Each aggregate point: value[0]=min, value[1]=max, value[2]=avg
    const minBpm = Math.min(...points.map(p => p.value?.[0]?.fpVal ?? Infinity));
    if (!isFinite(minBpm) || minBpm <= 0) continue;

    results.push({
      date: toYmd(Number(bucket.startTimeMillis)),
      bpm: Math.round(minBpm),
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Internal aggregate API types
// ---------------------------------------------------------------------------

interface AggBucket {
  startTimeMillis?: string;
  endTimeMillis?: string;
  dataset?: {
    point?: {
      value?: { intVal?: number; fpVal?: number }[];
    }[];
  }[];
}
