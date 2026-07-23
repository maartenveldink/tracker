import { test, expect } from '../fixtures/app';

const A = 'Barbell Bench Press';

/** Completes a one-set workout for exercise A so there is history to inspect. */
async function logOneWorkout(
  schemaEditor: import('../pages/SchemaEditorPage').SchemaEditorPage,
  startWorkout: import('../pages/StartWorkoutPage').StartWorkoutPage,
  workout: import('../pages/WorkoutPage').WorkoutPage,
  name: string,
) {
  await schemaEditor.gotoNew();
  await schemaEditor.setName(name);
  await schemaEditor.addExercise(A);
  await schemaEditor.save();
  await startWorkout.goto();
  await startWorkout.start(name);
  await workout.completeActiveSet(60, 10);
  await workout.finish();
}

test.describe('Progress & history', () => {
  test('a completed workout appears in the history and can be deleted', async ({
    schemaEditor,
    startWorkout,
    workout,
    history,
  }) => {
    await logOneWorkout(schemaEditor, startWorkout, workout, 'E2E History schema');

    await history.goto();
    await expect(history.entries).toHaveCount(1);

    await history.deleteFirst();
    await expect(history.entries).toHaveCount(0);
  });

  test('the records board lists a trained exercise', async ({
    schemaEditor,
    startWorkout,
    workout,
    progress,
    page,
  }) => {
    await logOneWorkout(schemaEditor, startWorkout, workout, 'E2E Records schema');

    await progress.goto();
    await progress.openTab('Records');
    await expect(page.getByText(A).first()).toBeVisible();
  });
});
