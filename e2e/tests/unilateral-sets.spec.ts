import { test, expect } from '../fixtures/app';

test.describe('Unilateral sets', () => {
  test('removing a set removes both sides of its left/right pair', async ({
    schemaEditor,
    startWorkout,
    workout,
    page,
  }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Unilateral schema');
    await schemaEditor.addExercise('Bulgarian Split Squat');
    await schemaEditor.save();

    await startWorkout.goto();
    await startWorkout.start('E2E Unilateral schema');

    // 3 planned sets x (left + right): one dot per pair.
    await expect.poll(() => workout.setCount()).toBe(3);

    await workout.removeLastSet();
    await expect.poll(() => workout.setCount()).toBe(2);

    // Removing again drops the next left+right pair.
    await workout.removeLastSet();
    await expect.poll(() => workout.setCount()).toBe(1);

    // Logging the left side opens the right side of the same set.
    await workout.completeActiveSet(20, 10);
    await expect(page.getByText('Set 1 · rechts')).toBeVisible();
    await expect(workout.doneRows).toHaveText([/Set 1 links · 20 kg × 10/]);
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
    await expect.poll(() => workout.setCount()).toBe(3);

    await workout.addSet();
    await expect.poll(() => workout.setCount()).toBe(4);
    await workout.removeLastSet();
    await expect.poll(() => workout.setCount()).toBe(3);
  });
});
