import { writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/app';

const A = 'Barbell Bench Press';
const SCHEMA = 'E2E Import schema';

/** Reads all workouts and schemas straight from IndexedDB (raw, as stored). */
async function readStored(page: Page) {
  return page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const req = indexedDB.open('TrackerDB');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const all = <T>(store: string) =>
      new Promise<T[]>((resolve, reject) => {
        const req = db.transaction(store).objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      });
    const workouts = await all<{
      id: string;
      schemaId: string | null;
      schemaDayId: string | null;
      startedAt: unknown;
      completedAt: unknown;
    }>('workouts');
    const schemas = await all<{ id: string; deleted: boolean; createdAt: unknown }>('schemas');
    const bodyWeights = await all<{ createdAt: unknown }>('bodyWeights');
    db.close();
    return {
      workouts: workouts.map(w => ({
        id: w.id,
        schemaId: w.schemaId,
        schemaDayId: w.schemaDayId,
        startedAtIsDate: w.startedAt instanceof Date,
        completedAtIsDate: w.completedAt instanceof Date,
      })),
      schemas: schemas.filter(s => !s.deleted).map(s => ({ id: s.id, createdAtIsDate: s.createdAt instanceof Date })),
      bodyWeightsAreDates: bodyWeights.every(b => b.createdAt instanceof Date),
    };
  });
}

test.describe('JSON import', () => {
  test('replace: dates come back as dates and workouts stay linked to the schema', async ({
    schemaEditor,
    startWorkout,
    workout,
    settings,
    dashboard,
    history,
    progress,
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    // Seed: schema + a logged workout + a body-weight entry.
    await schemaEditor.gotoNew();
    await schemaEditor.setName(SCHEMA);
    await schemaEditor.addExercise(A);
    await schemaEditor.save();
    await startWorkout.goto();
    await startWorkout.start(SCHEMA);
    await workout.completeActiveSet(60, 10);
    await workout.finish();
    await dashboard.goto();
    await dashboard.weighIn(80.5);
    await expect(dashboard.latestWeight()).toContainText('80,5');

    // Export, wipe, import (replace).
    await settings.goto();
    const file = testInfo.outputPath('tracker-export.json');
    await settings.exportTo(file);
    await settings.clearAll();
    await settings.importFrom(file, 'replace');

    // Raw storage holds real Dates again, not ISO strings.
    const stored = await readStored(page);
    expect(stored.workouts).toHaveLength(1);
    expect(stored.workouts[0]).toMatchObject({ startedAtIsDate: true, completedAtIsDate: true });
    expect(stored.schemas).toHaveLength(1);
    expect(stored.schemas[0]!.createdAtIsDate).toBe(true);
    expect(stored.bodyWeightsAreDates).toBe(true);
    expect(stored.workouts[0]!.schemaId).toBe(stored.schemas[0]!.id);

    // The screens that read the dates do not crash and show the data.
    await dashboard.goto();
    await expect(dashboard.latestWeight()).toContainText('80,5');
    await history.goto();
    await expect(history.entries).toHaveCount(1);
    await progress.goto();
    await progress.openTab('Overzicht');
    await expect(page.getByRole('heading', { name: 'Progressie' })).toBeVisible();
    await startWorkout.goto();
    await expect(page.getByText(/Laatste sessie: (Vandaag|Gisteren)/)).toHaveCount(1);

    expect(errors).toEqual([]);
  });

  test('merge: the imported workout is linked to the newly identified schema', async ({
    schemaEditor,
    startWorkout,
    workout,
    settings,
    history,
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await schemaEditor.gotoNew();
    await schemaEditor.setName(SCHEMA);
    await schemaEditor.addExercise(A);
    await schemaEditor.save();
    await startWorkout.goto();
    await startWorkout.start(SCHEMA);
    await workout.completeActiveSet(60, 10);
    await workout.finish();

    await settings.goto();
    const file = testInfo.outputPath('tracker-export.json');
    await settings.exportTo(file);

    // Merge the export on top of the existing data: now two schemas + two workouts.
    await settings.importFrom(file, 'merge');

    const stored = await readStored(page);
    expect(stored.schemas).toHaveLength(2);
    expect(stored.workouts).toHaveLength(2);
    const schemaIds = stored.schemas.map(s => s.id);
    const workoutSchemaIds = stored.workouts.map(w => w.schemaId);
    // Every workout points at an existing schema, and each schema has exactly one.
    expect([...workoutSchemaIds].sort()).toEqual([...schemaIds].sort());
    expect(stored.workouts.every(w => w.startedAtIsDate && w.completedAtIsDate)).toBe(true);

    // In the UI both (same-named) schemas show their own last session.
    await startWorkout.goto();
    await expect(page.getByText(/Laatste sessie: (Vandaag|Gisteren)/)).toHaveCount(2);
    await history.goto();
    await expect(history.entries).toHaveCount(2);

    expect(errors).toEqual([]);
  });

  test('merge: a workout whose schema is not in the export gets no dangling schemaId', async ({
    settings,
    page,
  }, testInfo) => {
    const file = testInfo.outputPath('orphan-export.json');
    const iso = new Date().toISOString();
    const orphan = {
      id: 'orphanworkout01',
      schemaId: 'deletedschema01',
      schemaName: 'Verwijderd schema',
      schemaDayId: 'day-1',
      schemaDayName: 'Dag 1',
      exercises: [],
      status: 'completed',
      startedAt: iso,
      pausedAt: null,
      totalPausedMs: 0,
      completedAt: iso,
      notes: '',
    };
    const data = { exportVersion: 1, exportedAt: iso, exercises: [], schemas: [], workouts: [orphan] };
    await writeFile(file, JSON.stringify(data));

    await settings.goto();
    await settings.importFrom(file, 'merge');

    const stored = await readStored(page);
    expect(stored.workouts).toHaveLength(1);
    expect(stored.workouts[0]).toMatchObject({ schemaId: null, schemaDayId: null, startedAtIsDate: true });
  });

  test('rejects a file with an invalid date with a clear message', async ({ settings, page }, testInfo) => {
    const file = testInfo.outputPath('bad-export.json');
    const bad = {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      exercises: [],
      schemas: [],
      workouts: [{ id: 'w1', schemaId: null, startedAt: 'geen-datum', pausedAt: null, completedAt: null, exercises: [] }],
    };
    await writeFile(file, JSON.stringify(bad));

    await settings.goto();
    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.getByText(/Ongeldige datum in workouts #1, veld "startedAt"/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Vervangen/ })).toHaveCount(0);
  });
});
