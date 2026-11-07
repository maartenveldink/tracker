import { test, expect } from '../fixtures/app';

test.describe('Unilateral sets', () => {
  test('removing a set removes both sides of its left/right pair', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Unilateral schema');
    await schemaEditor.addExercise('Bulgarian Split Squat');
    await schemaEditor.save();

    await startWorkout.goto();
    await startWorkout.start('E2E Unilateral schema');

    // 3 planned sets x (left + right) = 6 loggable sets.
    await expect.poll(() => workout.setCount()).toBe(6);

    await workout.removeLastSet();
    await expect.poll(() => workout.setCount()).toBe(4);

    // Removing a "left" set in the middle takes its "right" partner with it.
    await workout.removeSet(2);
    await expect.poll(() => workout.setCount()).toBe(2);
  });

  test('adding a set on a unilateral exercise adds a pair, which is removed as a pair', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Unilateral add schema');
    await schemaEditor.addExercise('Bulgarian Split Squat');
    await schemaEditor.save();

    await startWorkout.goto();
    await startWorkout.start('E2E Unilateral add schema');
    await expect.poll(() => workout.setCount()).toBe(6);

    await workout.addSet();
    await expect.poll(() => workout.setCount()).toBe(8);
    await workout.removeLastSet();
    await expect.poll(() => workout.setCount()).toBe(6);
  });
});
