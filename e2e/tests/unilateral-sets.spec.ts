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

    // Logging the left side opens the right side of the same set; a half set is not in Gedaan.
    await workout.completeActiveSet(20, 10);
    await expect(workout.sideDot(1, 'right')).toHaveAttribute('aria-pressed', 'true');
    await expect(workout.doneRows).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Set 1 links (klaar), aanpassen' })).toBeVisible();
  });

  test('zigzag L1 → R1 → L2: right gets the reps of left, rest only after the right side (D1U)', async ({
    schemaEditor,
    startWorkout,
    workout,
    page,
  }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Unilateral zigzag schema');
    await schemaEditor.addExercise('Bulgarian Split Squat');
    await schemaEditor.save();

    await startWorkout.goto();
    await startWorkout.start('E2E Unilateral zigzag schema');

    // 3 sets = 6 dots, zigzag order L1, R1, L2, R2, L3, R3; no B1 dots.
    await expect(workout.sideDots).toHaveCount(6);
    await expect(workout.setDots).toHaveCount(0);
    expect(
      await workout.sideDots.evaluateAll(els => els.map(e => `${e.getAttribute('data-side')}${e.getAttribute('data-set')}`)),
    ).toEqual(['left1', 'right1', 'left2', 'right2', 'left3', 'right3']);
    await expect(workout.sideDot(1, 'left')).toHaveAttribute('aria-pressed', 'true');

    // Left part: no rest yet, the idle ring says the rest follows after the right part.
    await workout.completeActiveSet(20, 12);
    await expect(workout.restTimer).toHaveCount(0);
    await expect(workout.restRingIdle).toHaveText('na R');
    await expect(workout.sideDot(1, 'right')).toHaveAttribute('aria-pressed', 'true');
    // The right part starts with the same weight and reps.
    await expect(workout.weightInput).toHaveValue('20');
    await expect(workout.repsInput).toHaveValue('12');
    await expect(workout.doneRows).toHaveCount(0);

    // Right part with one tap: the set is complete, the rest starts, L2 opens.
    await page.getByRole('button', { name: 'Set klaar', exact: true }).click();
    await expect(workout.restTimer).toBeVisible();
    await expect(workout.sideDot(2, 'left')).toHaveAttribute('aria-pressed', 'true');
    await expect(workout.doneRows).toHaveCount(1);
    await expect(workout.doneRows.first()).toContainText('Set 1 · 20 kg · L 12 · R 12');
    await expect(workout.doneRows.first()).toContainText('nieuw');

    // A done part can be reopened and adjusted ("Opslaan").
    await workout.sideDot(1, 'right').click();
    await expect(workout.primaryButton).toHaveText('Opslaan');
    await workout.repsInput.fill('11');
    await workout.primaryButton.click();
    await expect(workout.doneRows.first()).toContainText('Set 1 · 20 kg · L 12 · R 11');
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
