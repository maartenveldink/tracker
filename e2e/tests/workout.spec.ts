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

    // Set 2 inherits the weight that was just logged for set 1 (the stepper stays put).
    await expect(workout.weightInput).toHaveValue('62,5');
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

  test('does not start a rest timer after the last set of an exercise', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await createSimpleSchema(schemaEditor, 'E2E No Rest Last');
    await startWorkout.goto();
    await startWorkout.start('E2E No Rest Last');

    await workout.completeActiveSet(60, 10);
    await expect(workout.restTimer).toBeVisible();
    await workout.logActiveReps(10);
    await expect(workout.restTimer).toBeVisible();
    // Third (last) set: the running timer is dropped, no new one starts.
    await workout.logActiveReps(10);
    await expect(workout.primaryButton).toHaveText('Laatste oefening afronden');
    await expect(workout.restTimer).toHaveCount(0);
  });

  test('B1: the Gedaan list shows the difference, a logged set can be opened and saved', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await createSimpleSchema(schemaEditor, 'E2E B1 schema');
    // Baseline session: 3 × 60 kg × 10.
    await startWorkout.goto();
    await startWorkout.start('E2E B1 schema');
    await workout.completeExercise(60, 10);
    await workout.finish();

    await startWorkout.goto();
    await startWorkout.start('E2E B1 schema');
    await workout.completeActiveSet(60, 11);
    await workout.logActiveReps(10);
    await expect(workout.doneRows).toHaveText([/Set 1 · 60 kg × 11\s*↑ \+1/, /Set 2 · 60 kg × 10\s*gelijk/]);
    // The next open set is opened by default, set 1 is done.
    await expect(workout.setDots.nth(2)).toHaveAttribute('aria-pressed', 'true');
    await expect(workout.setDots.nth(0)).toHaveAccessibleName('Set 1 (klaar), aanpassen');

    // Open the logged set 1, lower the weight and save: no rest restart, back to set 3.
    await workout.openSet(0);
    await expect(workout.primaryButton).toHaveText('Opslaan');
    await expect(workout.repsInput).toHaveValue('11');
    await workout.weightInput.fill('57,5');
    await workout.primaryButton.click();
    await expect(workout.doneRows.first()).toHaveText(/Set 1 · 57,5 kg × 11\s*↓ 2,5 kg/);
    await expect(workout.primaryButton).toHaveText('Set klaar');
    await expect(workout.setDots.nth(2)).toHaveAttribute('aria-pressed', 'true');
  });
});
