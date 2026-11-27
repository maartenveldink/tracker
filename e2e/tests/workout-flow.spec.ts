import { test, expect } from '../fixtures/app';

const A = 'Barbell Bench Press';
const B = 'Barbell Row';

/** 105 -> "1:45" (rest clock). */
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

test.describe('Live workout — one exercise at a time', () => {
  test('walks through exercises, skips one and ends in the klaar-toestand', async ({
    schemaEditor,
    startWorkout,
    workout,
    page,
  }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Flow');
    await schemaEditor.addExercise(A);
    await schemaEditor.addExercise(B);
    await schemaEditor.save();

    await startWorkout.goto();
    await startWorkout.start('E2E Flow');
    await expect(workout.currentTitle).toContainText(A);
    await expect(workout.primaryButton).toHaveText('Set klaar');

    // Finishing the last set turns the button into "Volgende oefening".
    await workout.completeExercise(60, 10);
    await expect(workout.primaryButton).toHaveText('Volgende oefening');
    await workout.nextExercise();
    await expect(workout.currentTitle).toContainText(B);

    // Skipping the last open exercise leads to the klaar-toestand.
    await workout.skipExercise(B);
    await expect(workout.currentTitle).toHaveText('Training klaar');
    await expect(workout.primaryButton).toHaveText('Training afronden');

    // Restoring the skipped exercise in the overview makes it current again.
    await workout.openOverview();
    await page.getByRole('button', { name: `${B} terugzetten` }).click();
    await workout.closeSheet();
    await expect(workout.currentTitle).toContainText(B);
  });

  test('"Laatste oefening afronden" leads to the klaar-toestand and finishing works', async ({
    schemaEditor,
    startWorkout,
    workout,
    page,
  }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Last');
    await schemaEditor.addExercise(A);
    await schemaEditor.save();

    await startWorkout.goto();
    await startWorkout.start('E2E Last');
    await workout.completeExercise(60, 10);
    await expect(workout.primaryButton).toHaveText('Laatste oefening afronden');
    await workout.primaryButton.click();
    await expect(workout.currentTitle).toHaveText('Training klaar');

    await workout.primaryButton.click();
    await page.waitForURL(/\/workout\/[^\/]+\/summary$/);
  });

  test('the rest ring opens the rest bar: idle it sets and starts the rest, running it adjusts it', async ({
    schemaEditor,
    startWorkout,
    workout,
    page,
  }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Rust-balk');
    await schemaEditor.addExercise(A);
    await schemaEditor.save();

    await startWorkout.goto();
    await startWorkout.start('E2E Rust-balk');

    // Idle: the bar shows the set rest duration; + makes it exactly 15 s longer.
    // (The bar closes 3 s after opening / the last tap, so tap first, assert after.)
    const idle = await workout.idleRestSeconds();
    await workout.openRestBar();
    await workout.adjustRest('longer');
    await expect(workout.restBarTime).toHaveText(clock(idle + 15));
    // No "Set klaar" next to the bar.
    await expect(page.getByRole('button', { name: 'Set klaar', exact: true })).toHaveCount(0);

    // A tap on the time closes the bar right away and (idle) starts the rest by hand.
    await workout.closeRestBar();
    await expect(workout.restBar).toHaveCount(0);
    await expect(workout.restTimer).toBeVisible();
    expect(await workout.restSeconds()).toBeGreaterThan(idle + 5);

    // Running: + adds 15 s to the remaining rest; the bar closes ~3 s after the last tap.
    const before = await workout.restSeconds();
    await workout.openRestBar();
    await workout.adjustRest('longer');
    await expect.poll(() => workout.restBarSeconds()).toBeGreaterThan(before + 10);
    await expect(workout.restBar).toHaveCount(0, { timeout: 6000 });
    await expect(page.getByRole('button', { name: 'Set klaar', exact: true })).toBeVisible();

    // The adjusted rest holds for the next sets of this exercise.
    await workout.completeActiveSet(60, 10);
    expect(await workout.restSeconds()).toBeGreaterThan(idle + 5);
  });

  test('a set cannot be logged without a weight', async ({ startWorkout, workout, page }) => {
    await startWorkout.goto();
    await startWorkout.startFree();
    await workout.addExercise(A);

    await workout.repsInput.fill('10');
    await page.getByRole('button', { name: 'Set klaar', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Vul eerst een gewicht in');
  });
});
