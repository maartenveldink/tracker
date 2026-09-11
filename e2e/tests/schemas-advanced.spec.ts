import { test, expect } from '../fixtures/app';

const A = 'Barbell Bench Press';
const B = 'Barbell Row';

test.describe('Schemas — advanced', () => {
  test('builds a multi-day schema and starts a chosen day', async ({
    schemaEditor,
    startWorkout,
    page,
  }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Split');
    await schemaEditor.addExercise(A); // goes to day 1 once we split
    await schemaEditor.addDay();         // convert to multi-day (Dag 1 + Dag 2)
    await schemaEditor.selectDay('Dag 2');
    await schemaEditor.addExercise(B);
    await schemaEditor.save();

    // Start day 2 specifically → its exercise (B) is loaded.
    await startWorkout.goto();
    await startWorkout.startDay('E2E Split', 'Dag 2');
    await expect(page.getByRole('heading', { name: B })).toBeVisible();
  });

  test('creates a brand-new exercise while building a schema and adds it', async ({
    schemaEditor,
    exercises,
    page,
  }) => {
    const NEW = 'E2E Cable Pullover';

    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Inline Create');

    // The exercise does not exist yet — create it in full from the picker sheet.
    await schemaEditor.createAndAddExercise(NEW, 'Geïsoleerde lat-stretch');

    // It lands in the schema's exercise list right away.
    await expect(schemaEditor.exerciseRow(NEW)).toBeVisible();

    await schemaEditor.save();
    await expect(page.getByText(NEW, { exact: true })).toBeVisible();

    // It was really persisted as a reusable exercise, not just added to the schema.
    await exercises.goto();
    await expect(page.getByText(NEW, { exact: true })).toBeVisible();
  });

  test('shows the muscle-coverage breakdown on the detail page', async ({ schemaEditor, page }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Coverage');
    await schemaEditor.addExercise(A);
    await schemaEditor.save();

    await expect(page.getByRole('heading', { name: 'Spiergroepverdeling' })).toBeVisible();
  });

  test('tapping a muscle bar lists the exercises for that group', async ({ schemaEditor, page }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Muscle');
    await schemaEditor.addExercise(A);
    await schemaEditor.save();

    await page.getByTestId('muscle-bar').first().click();

    const dialog = page.getByTestId('muscle-exercises');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(A)).toBeVisible();
  });
});
