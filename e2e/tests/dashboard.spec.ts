import { test, expect } from '../fixtures/app';

const A = 'Barbell Bench Press';

test.describe('Dashboard', () => {
  test('records a quick body-weight entry', async ({ dashboard }) => {
    await dashboard.goto();
    await dashboard.weighIn(80);

    await expect(dashboard.latestWeight()).toContainText('80');
  });

  test('offers to resume an active workout', async ({ schemaEditor, startWorkout, dashboard, page }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Resume schema');
    await schemaEditor.addExercise(A);
    await schemaEditor.save();

    await startWorkout.goto();
    await startWorkout.start('E2E Resume schema');

    await dashboard.goto();
    await expect(dashboard.resumeButton).toBeVisible();

    await dashboard.resumeButton.click();
    await expect(page).toHaveURL(/\/workout\/\d+$/);
  });
});
