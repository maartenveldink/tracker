import { test, expect } from '../fixtures/app';

const A = 'Barbell Bench Press';

async function simpleSchema(
  schemaEditor: import('../pages/SchemaEditorPage').SchemaEditorPage,
  name: string,
) {
  await schemaEditor.gotoNew();
  await schemaEditor.setName(name);
  await schemaEditor.addExercise(A);
  await schemaEditor.save();
}

test.describe('Live workout — advanced', () => {
  test('adds and removes sets', async ({ schemaEditor, startWorkout, workout }) => {
    await simpleSchema(schemaEditor, 'E2E Sets');
    await startWorkout.goto();
    await startWorkout.start('E2E Sets');

    expect(await workout.setCount()).toBe(3); // default
    await workout.addSet();
    await expect.poll(() => workout.setCount()).toBe(4);

    await workout.removeLastSet();
    await expect.poll(() => workout.setCount()).toBe(3);
  });

  test('lets the rest timer be skipped', async ({ schemaEditor, startWorkout, workout }) => {
    await simpleSchema(schemaEditor, 'E2E Skip');
    await startWorkout.goto();
    await startWorkout.start('E2E Skip');

    await workout.completeActiveSet(60, 10);
    await expect(workout.restTimer).toBeVisible();

    await workout.skipRest();
    await expect(workout.restTimer).toHaveCount(0);
  });

  test('does NOT bump the weight when a set falls short of the target', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await simpleSchema(schemaEditor, 'E2E NoBump'); // default 3×10

    await startWorkout.goto();
    await startWorkout.start('E2E NoBump');
    await workout.completeActiveSet(60, 10);
    await workout.logActiveReps(10);
    await workout.logActiveReps(8); // last set below the target of 10
    await workout.finish();

    // Next session keeps the same weight (no progression).
    await startWorkout.goto();
    await startWorkout.start('E2E NoBump');
    await expect(workout.setWeightInput(0)).toHaveAttribute('placeholder', '60');
  });
});
