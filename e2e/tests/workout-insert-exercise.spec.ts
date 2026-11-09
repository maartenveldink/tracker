import { test, expect } from '../fixtures/app';
import type { SchemaEditorPage } from '../pages/SchemaEditorPage';

const A = 'Barbell Bench Press';
const B = 'Barbell Row';
const C = 'Barbell Back Squat';
const NEW = 'Overhead Press';

async function schemaWith(schemaEditor: SchemaEditorPage, name: string, exercises: string[]) {
  await schemaEditor.gotoNew();
  await schemaEditor.setName(name);
  for (const ex of exercises) await schemaEditor.addExercise(ex);
}

test.describe('Live workout — exercise added mid-workout', () => {
  test('lands right after the last finished exercise, not at the bottom', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await schemaWith(schemaEditor, 'E2E Insert', [A, B, C]);
    await schemaEditor.save();
    await startWorkout.goto();
    await startWorkout.start('E2E Insert');

    await workout.completeExercise(60, 10);
    await expect.poll(() => workout.exerciseMeta(0)).toContain('3/3 sets');

    await workout.addExercise(NEW);

    // Position 2 (right after the finished first exercise), not at the bottom.
    await expect.poll(() => workout.exerciseOrder()).toEqual([A, NEW, B, C]);
    // The new exercise is shown, ready to log.
    await expect(workout.currentTitle).toContainText(NEW);
  });

  test('without any finished exercise it goes behind the one in progress', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await schemaWith(schemaEditor, 'E2E Insert partial', [A, B]);
    await schemaEditor.save();
    await startWorkout.goto();
    await startWorkout.start('E2E Insert partial');

    // One of three sets logged: A is in progress, nothing is finished.
    await workout.completeActiveSet(60, 10);
    await expect.poll(() => workout.exerciseMeta(0)).toContain('1/3 sets');
    await workout.addExercise(NEW);

    await expect.poll(() => workout.exerciseOrder()).toEqual([A, NEW, B]);
  });

  test('without any started exercise it goes to the front', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await schemaWith(schemaEditor, 'E2E Insert fresh', [A, B]);
    await schemaEditor.save();
    await startWorkout.goto();
    await startWorkout.start('E2E Insert fresh');

    await workout.addExercise(NEW);

    await expect.poll(() => workout.exerciseOrder()).toEqual([NEW, A, B]);
  });

  test('works in a free (ad-hoc) workout', async ({ startWorkout, workout }) => {
    await startWorkout.goto();
    await startWorkout.startFree();
    await workout.addExercise(A);
    await workout.addExercise(B);
    // Both added while nothing was started: each goes to the front.
    await expect.poll(() => workout.exerciseOrder()).toEqual([B, A]);

    await workout.completeExercise(60, 10);
    await expect.poll(() => workout.exerciseMeta(0)).toContain('3/3 sets');
    await workout.addExercise(C);

    await expect.poll(() => workout.exerciseOrder()).toEqual([B, C, A]);
  });

  test('never splits a superset: goes behind the whole group', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await schemaWith(schemaEditor, 'E2E Insert superset', [A, B, C]);
    await schemaEditor.linkWithPrevious(B);
    await schemaEditor.save();
    await startWorkout.goto();
    await startWorkout.start('E2E Insert superset');
    await expect(workout.supersetBadge).toContainText('A');

    // Give A a single set, so A is finished after round one while B is not.
    await workout.removeLastSet();
    await expect.poll(() => workout.setCount()).toBe(2);
    await workout.removeLastSet();
    await expect.poll(() => workout.setCount()).toBe(1);
    await workout.completeActiveSet(60, 10); // A: 1/1 → hands over to B
    await expect(workout.currentTitle).toContainText(B);
    await workout.completeActiveSet(50, 10); // B: 1/3 → round over
    await expect.poll(() => workout.exerciseMeta(0)).toContain('1/1 sets');
    await expect.poll(() => workout.exerciseMeta(1)).toContain('1/3 sets');

    await workout.addExercise(NEW);

    // Not between A and B: after the group, before the next solo exercise.
    await expect.poll(() => workout.exerciseOrder()).toEqual([A, B, NEW, C]);
    expect(await workout.exerciseSuperset(0)).toBe('A');
    expect(await workout.exerciseSuperset(1)).toBe('B');
    expect(await workout.exerciseSuperset(2)).toBeNull();
  });

  test('logging the new exercise edits it, and the others stay put', async ({
    schemaEditor,
    startWorkout,
    workout,
    page,
  }) => {
    await schemaWith(schemaEditor, 'E2E Insert log', [A, B]);
    await schemaEditor.save();
    await startWorkout.goto();
    await startWorkout.start('E2E Insert log');

    await workout.completeExercise(60, 10);
    await workout.addExercise(NEW);
    await expect.poll(() => workout.exerciseOrder()).toEqual([A, NEW, B]);
    await expect(workout.currentTitle).toContainText(NEW);

    // Log all sets of the new exercise, then move on.
    await workout.completeExercise(40, 8);
    await expect.poll(() => workout.exerciseMeta(1)).toContain('3/3 sets');
    await workout.nextExercise();
    // The following exercise is untouched and now active.
    await expect.poll(() => workout.exerciseMeta(2)).toMatch(/^3 sets/);
    await expect(workout.currentTitle).toContainText(B);
    await workout.completeActiveSet(70, 12);
    await expect.poll(() => workout.exerciseMeta(2)).toContain('1/3 sets');

    // Order is stable and the weights belong to the right exercises.
    await expect.poll(() => workout.exerciseOrder()).toEqual([A, NEW, B]);
    await expect.poll(() => workout.exerciseMeta(0)).toContain('3/3 sets');
    await expect.poll(() => workout.exerciseMeta(1)).toContain('3/3 sets');

    // The order and per-exercise progress survive a reload from IndexedDB.
    await page.reload();
    await expect.poll(() => workout.exerciseOrder()).toEqual([A, NEW, B]);
    await expect.poll(() => workout.exerciseMeta(1)).toContain('3/3 sets');
    await expect.poll(() => workout.exerciseMeta(2)).toContain('1/3 sets');
  });
});
