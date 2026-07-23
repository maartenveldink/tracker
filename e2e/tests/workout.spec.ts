import { test, expect } from '../fixtures/app';

const A = 'Barbell Bench Press';

/** Arrange: create a simple one-exercise schema and return its name. */
async function createSimpleSchema(schemaEditor: import('../pages/SchemaEditorPage').SchemaEditorPage, name: string) {
  await schemaEditor.gotoNew();
  await schemaEditor.setName(name);
  await schemaEditor.addExercise(A);
  await schemaEditor.save();
}

test.describe('Live workout', () => {
  test('runs a free workout and reaches the summary', async ({ startWorkout, workout, page }) => {
    await startWorkout.goto();
    await startWorkout.startFree();

    await workout.addExercise(A);
    await workout.completeActiveSet(60, 10);
    await workout.finish();

    await expect(page.getByRole('heading', { name: 'Samenvatting' })).toBeVisible();
  });

  test('runs a workout from a schema and reaches the summary', async ({
    schemaEditor,
    startWorkout,
    workout,
    page,
  }) => {
    await createSimpleSchema(schemaEditor, 'E2E Workout schema');

    await startWorkout.goto();
    await startWorkout.start('E2E Workout schema');
    await workout.completeActiveSet(60, 10);
    await workout.finish();

    await expect(page.getByRole('heading', { name: 'Samenvatting' })).toBeVisible();
    await expect(page.getByText('Sets')).toBeVisible();
  });

  test('pauses and resumes a workout', async ({ schemaEditor, startWorkout, workout }) => {
    await createSimpleSchema(schemaEditor, 'E2E Pause schema');
    await startWorkout.goto();
    await startWorkout.start('E2E Pause schema');

    await workout.pause();
    await expect(workout.pausedBanner).toBeVisible();

    await workout.resume();
    await expect(workout.pausedBanner).toHaveCount(0);
  });

  test('carries the entered weight over to the next set', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await createSimpleSchema(schemaEditor, 'E2E Carry schema');
    await startWorkout.goto();
    await startWorkout.start('E2E Carry schema');

    await workout.completeActiveSet(62.5, 10);

    // Set 2 (index 1) inherits the weight that was just logged for set 1.
    await expect(workout.setWeightInput(1)).toHaveValue('62.5');
  });

  test('starts the rest timer after a normal set', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await createSimpleSchema(schemaEditor, 'E2E Rest schema');
    await startWorkout.goto();
    await startWorkout.start('E2E Rest schema');

    await expect(workout.restTimer).toHaveCount(0);
    await workout.completeActiveSet(60, 10);
    await expect(workout.restTimer).toBeVisible();
  });
});
