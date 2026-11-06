import type { Page } from '@playwright/test';

/**
 * Seeds completed workouts and body-weight entries straight into IndexedDB
 * (fast, deterministic history without driving the live-workout UI). Call after
 * the app has loaded once (so the DB + default exercises exist); reload the
 * page afterwards, because raw writes do not trigger Dexie live queries.
 */
export interface SeedSet {
  reps: number;
  /** null = bodyweight set. */
  weight: number | null;
  plannedReps?: number;
  plannedRepsMax?: number;
  /** Planned but not done. */
  skipped?: boolean;
  /** Unilateral exercises log each planned set as a left + right pair. */
  side?: 'left' | 'right';
}

export interface SeedExercise {
  /** Name of a default (seeded) exercise, e.g. "Barbell Bench Press". */
  name: string;
  notes?: string;
  sets: SeedSet[];
}

export interface SeedWorkout {
  daysAgo: number;
  schemaName?: string;
  dayName?: string;
  notes?: string;
  exercises: SeedExercise[];
}

export interface SeedBodyWeight {
  daysAgo: number;
  kg: number;
}

export async function seedTraining(
  page: Page,
  data: {
    workouts: SeedWorkout[];
    bodyWeights?: SeedBodyWeight[];
    /** Names of exercises to soft-delete after seeding (their history stays). */
    deletedExercises?: string[];
  },
): Promise<void> {
  await page.evaluate(async ({ workouts, bodyWeights, deletedExercises }) => {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const req = indexedDB.open('TrackerDB');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const done = (tx: IDBTransaction) =>
      new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    const idOf = (i: number) => `seed${String(i).padStart(11, '0')}`;
    const DAY = 86400000;
    const now = Date.now();

    // Exercises are seeded asynchronously on first load; wait for them.
    let exercises: { id: string; name: string }[] = [];
    for (let i = 0; i < 50 && exercises.length === 0; i++) {
      exercises = await new Promise((resolve, reject) => {
        const req = db.transaction('exercises').objectStore('exercises').getAll();
        req.onsuccess = () => resolve(req.result as { id: string; name: string }[]);
        req.onerror = () => reject(req.error);
      });
      if (exercises.length === 0) await new Promise(r => setTimeout(r, 100));
    }
    const idByName = new Map(exercises.map(e => [e.name, e.id]));
    const meta = { clientUpdatedAt: now, deleted: false, dirty: 0 };

    const tx = db.transaction(['workouts', 'bodyWeights', 'exercises'], 'readwrite');
    workouts.forEach((w, wi) => {
      const startedAt = new Date(now - w.daysAgo * DAY);
      tx.objectStore('workouts').put({
        id: idOf(wi + 1),
        schemaId: null,
        schemaName: w.schemaName ?? null,
        schemaDayId: null,
        schemaDayName: w.dayName ?? null,
        exercises: w.exercises.map((e, ei) => {
          const exerciseId = idByName.get(e.name);
          if (!exerciseId) throw new Error(`Unknown seed exercise: ${e.name}`);
          return {
            exerciseId,
            order: ei,
            notes: e.notes ?? '',
            sets: e.sets.map((s, si) => ({
              exerciseId,
              setNumber: si + 1,
              plannedReps: s.plannedReps ?? null,
              ...(s.plannedRepsMax != null ? { plannedRepsMax: s.plannedRepsMax } : {}),
              actualReps: s.skipped ? null : s.reps,
              weight: s.skipped ? null : s.weight,
              completed: !s.skipped,
              skipped: s.skipped ?? false,
              ...(s.side ? { side: s.side } : {}),
            })),
          };
        }),
        status: 'completed',
        startedAt,
        pausedAt: null,
        totalPausedMs: 0,
        completedAt: new Date(startedAt.getTime() + 55 * 60000),
        notes: w.notes ?? '',
        ...meta,
      });
    });
    (bodyWeights ?? []).forEach((b, bi) => {
      const d = new Date(now - b.daysAgo * DAY);
      const date = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      tx.objectStore('bodyWeights').put({
        id: idOf(100 + bi),
        date,
        weightKg: b.kg,
        createdAt: d,
        ...meta,
      });
    });
    for (const name of deletedExercises ?? []) {
      const row = exercises.find(e => e.name === name);
      if (row) tx.objectStore('exercises').put({ ...row, deleted: true, dirty: 0 });
    }
    await done(tx);
    db.close();
  }, data);
}
