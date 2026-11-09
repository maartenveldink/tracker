import { test, expect } from '../fixtures/app';

const A = 'Barbell Bench Press';
const B = 'Barbell Row';

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
    await page.getByRole('button', { name: 'Oefening overslaan' }).click();
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

  test('the rest strip can be extended by 30 seconds', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Extend');
    await schemaEditor.addExercise(A);
    await schemaEditor.save();

    await startWorkout.goto();
    await startWorkout.start('E2E Extend');
    await workout.completeActiveSet(60, 10);
    const secs = async () => {
      const label = (await workout.restTimer.getByRole('timer').getAttribute('aria-label')) ?? '';
      const m = label.match(/(\d+) minuten (\d+) seconden/);
      return Number(m?.[1]) * 60 + Number(m?.[2]);
    };
    const before = await secs();
    await workout.restTimer.getByRole('button', { name: '+30 sec' }).click();
    expect(await secs()).toBeGreaterThan(before + 20);
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
