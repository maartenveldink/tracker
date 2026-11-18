import { test, expect } from '../fixtures/app';

const A = 'Barbell Bench Press';
const B = 'Barbell Row';

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

  test('celebrates in the workout when an exercise beats the previous session', async ({
    startWorkout,
    workout,
    page,
  }) => {
    await freeWorkout(startWorkout, workout, 60); // baseline

    await startWorkout.goto();
    await startWorkout.startFree();
    await workout.addExercise(A);
    // Trim to a single set so completing it finishes the exercise.
    await workout.removeLastSet();
    await workout.removeLastSet();
    await workout.completeActiveSet(70, 10); // heavier -> a better session

    await expect(page.getByTestId('celebration')).toBeVisible();
    await expect(page.getByTestId('moment-banner')).toContainText('Beter dan vorige keer');

    // A reload must not replay the effects.
    await page.reload();
    await expect(page.getByTestId('celebration')).toHaveCount(0);
  });

  test('celebrates a superset member although the focus moves to its partner, without replay', async ({
    schemaEditor,
    startWorkout,
    workout,
    page,
  }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('Superset viering');
    await schemaEditor.addExercise(A);
    await schemaEditor.addExercise(B);
    await schemaEditor.linkWithPrevious(B);
    await schemaEditor.save();

    // Baseline: one round of the superset.
    await startWorkout.goto();
    await startWorkout.start('Superset viering');
    await workout.completeActiveSet(60, 10);
    await workout.completeActiveSet(50, 10);
    await workout.finish();

    // Trim A to a single set, so logging it finishes A while B is still open.
    await startWorkout.goto();
    await startWorkout.start('Superset viering');
    await workout.removeLastSet();
    await expect.poll(() => workout.setCount()).toBe(2);
    await workout.removeLastSet();
    await expect.poll(() => workout.setCount()).toBe(1);
    await workout.completeActiveSet(70, 10);

    await expect(workout.currentTitle).toContainText(B);
    await expect(page.getByTestId('celebration')).toBeVisible();
    await expect(page.getByTestId('celebration')).toHaveCount(0, { timeout: 10_000 });

    // Going back to the finished exercise shows the result without replaying anything.
    await workout.openOverview();
    await workout.overviewRows.nth(0).getByRole('button').first().click();
    await expect(workout.currentTitle).toContainText(A);
    await expect(page.getByTestId('moment-banner')).toBeVisible();
    await expect(page.getByTestId('moment-banner')).not.toHaveClass(/animate-banner-pop/);
    await expect(page.getByTestId('celebration')).toHaveCount(0);
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
    // "Oefeningen" is the default tab and shows the %1RM list.
    await progress.openTab('Oefeningen');

    await expect(page.getByText(A, { exact: true })).toBeVisible();
    await expect(page.getByText(/sessies/)).toBeVisible();
    await expect(page.getByText(/%$/)).toBeVisible();
  });
});
