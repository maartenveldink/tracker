import { test, expect } from '../fixtures/app';

const A = 'Barbell Bench Press';

/** Runs a one-set free workout for exercise A at the given weight, to summary. */
async function freeWorkout(
  startWorkout: import('../pages/StartWorkoutPage').StartWorkoutPage,
  workout: import('../pages/WorkoutPage').WorkoutPage,
  weight: number,
) {
  await startWorkout.goto();
  await startWorkout.startFree();
  await workout.addExercise(A);
  await workout.completeActiveSet(weight, 10);
  await workout.finish();
}

test.describe('Progression', () => {
  test('the summary flags an exercise that beat the previous session', async ({
    startWorkout,
    workout,
    page,
  }) => {
    // Session 1 sets the all-time best (80). Session 2 dips (60). Session 3 (70)
    // beats session 2 but stays under the all-time best — so it is "Vooruitgang"
    // (progress vs previous session), NOT a personal record.
    await freeWorkout(startWorkout, workout, 80);
    await freeWorkout(startWorkout, workout, 60);
    await freeWorkout(startWorkout, workout, 70);

    await expect(page.getByText('Vooruitgang')).toBeVisible();
    await expect(page.getByText('Persoonlijk record!')).toHaveCount(0);
  });

  test('the summary shows a personal record on an all-time best', async ({
    startWorkout,
    workout,
    page,
  }) => {
    await freeWorkout(startWorkout, workout, 60);
    await freeWorkout(startWorkout, workout, 80); // new all-time best

    await expect(page.getByText('Persoonlijk record!')).toBeVisible();
  });

  test('the progression tab lists an exercise with its 1RM change', async ({
    startWorkout,
    workout,
    progress,
    page,
  }) => {
    await freeWorkout(startWorkout, workout, 60);
    await freeWorkout(startWorkout, workout, 70); // 1RM up vs first session

    await progress.goto();
    await progress.openTab('Progressie');

    await expect(page.getByText(A, { exact: true })).toBeVisible();
    await expect(page.getByText(/sessies/)).toBeVisible();
    await expect(page.getByText(/%$/)).toBeVisible();
  });
});
