import { test, expect } from '../fixtures/app';

// Seeded default exercises, added to a free workout. Nothing is started yet, so
// every added exercise lands at the front (`findInsertIndex`): add in reverse order.
const A = 'Barbell Bench Press';
const B = 'Barbell Row';
const C = 'Overhead Press';

test.describe('Supersets — link in the live overview', () => {
  test('a free workout links two exercises into the E2 zigzag and unlinks them again', async ({
    startWorkout,
    workout,
  }) => {
    await startWorkout.goto();
    await startWorkout.startFree();
    await workout.addExercise(B);
    await workout.addExercise(A);
    expect(await workout.exerciseOrder()).toEqual([A, B]);
    await expect(workout.supersetLabel).toHaveCount(0);

    // The first exercise has no link button; the second offers "Superset met vorige".
    await workout.openOverview();
    await expect(workout.overviewLinkButton(A)).toHaveCount(0);
    await expect(workout.overviewLinkButton(B)).toBeVisible();
    await workout.closeSheet();

    await workout.linkWithPrevious(B);
    await expect(workout.supersetLabel).toHaveText('Superset');
    await expect(workout.currentTitle).toContainText(A);
    await expect(workout.supersetDots).toHaveCount(6);
    await expect(workout.supersetDot(1, 'A')).toHaveAttribute('aria-pressed', 'true');
    await expect(workout.restRingIdle).toContainText('na B');
    expect(await workout.exerciseSuperset(0)).toBe('A');
    expect(await workout.exerciseSuperset(1)).toBe('B');

    // A of round 1 logged: B opens without rest, as in any superset pair.
    await workout.completeActiveSet(60, 10);
    await expect(workout.currentTitle).toContainText(B);
    await expect(workout.restTimer).toHaveCount(0);

    // Unlinking is always allowed; the logged set stays with A.
    await workout.unlinkFromPrevious(B);
    await expect(workout.supersetLabel).toHaveCount(0);
    await expect(workout.supersetDots).toHaveCount(0);
    expect(await workout.exerciseSuperset(1)).toBeNull();
    expect(await workout.exerciseMeta(0)).toContain('1/3 sets');
  });

  test('no link button once an exercise is started; a third joins as a group of three', async ({
    startWorkout,
    workout,
  }) => {
    await startWorkout.goto();
    await startWorkout.startFree();
    await workout.addExercise(C);
    await workout.addExercise(B);
    await workout.addExercise(A);
    expect(await workout.exerciseOrder()).toEqual([A, B, C]);

    await workout.linkWithPrevious(B);
    await workout.linkWithPrevious(C);
    // Three members: the pill per member instead of the pair zigzag.
    await expect(workout.supersetLabel).toHaveCount(0);
    await expect(workout.supersetBadge).toBeVisible();
    expect(await workout.exerciseSuperset(2)).toBe('C');

    // Splitting at B keeps B + C as a pair; A is on its own again.
    await workout.unlinkFromPrevious(B);
    expect(await workout.exerciseSuperset(0)).toBeNull();
    expect(await workout.exerciseSuperset(1)).toBe('A');
    expect(await workout.exerciseSuperset(2)).toBe('B');

    // A logged set on A: B can no longer be linked to it.
    await expect(workout.currentTitle).toContainText(A);
    await workout.completeActiveSet(60, 10);
    await workout.openOverview();
    await expect(workout.overviewLinkButton(B)).toHaveCount(0);
    await expect(workout.overviewUnlinkButton(C)).toBeVisible();
    await workout.closeSheet();
  });
});
