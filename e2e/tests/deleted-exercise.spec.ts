import { test, expect } from '../fixtures/app';

/**
 * A soft-deleted exercise (tombstone) that is still referenced by a schema or a
 * finished workout must keep its real name wherever that history is displayed,
 * but must not be offered in any picker.
 */
test.describe('Deleted exercise', () => {
  test('keeps its name in schemas and history, but leaves the pickers', async ({
    exerciseForm,
    exercises,
    schemaEditor,
    startWorkout,
    workout,
    dashboard,
    page,
  }) => {
    const NAME = 'E2E Ghost Curl';

    // An exercise used in a schema and in a finished workout.
    await exerciseForm.create(NAME);
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Ghost schema');
    await schemaEditor.addExercise(NAME);
    await schemaEditor.save();
    const schemaUrl = page.url();

    await startWorkout.goto();
    await startWorkout.start('E2E Ghost schema');
    await workout.completeActiveSet(20, 10);
    await workout.finish();
    const summaryUrl = page.url();
    const editUrl = summaryUrl.replace(/\/summary$/, '/edit');

    // Delete it from the library (confirmation dialog included).
    await exercises.goto();
    await exercises.delete(NAME);
    await expect(exercises.card(NAME)).toHaveCount(0);

    // Schema detail still shows the real name.
    await page.goto(schemaUrl);
    await expect(page.getByText(NAME, { exact: true })).toBeVisible();
    await expect(page.getByText('Onbekend')).toHaveCount(0);

    // Workout summary and workout edit too.
    await page.goto(summaryUrl);
    await expect(page.getByRole('heading', { name: NAME })).toBeVisible();
    await expect(page.getByText('Onbekend')).toHaveCount(0);
    await page.goto(editUrl);
    await expect(page.getByRole('heading', { name: NAME })).toBeVisible();
    await expect(page.getByText('Onbekend')).toHaveCount(0);

    // Dashboard "recent records".
    await dashboard.goto();
    await expect(page.getByText(NAME, { exact: true })).toBeVisible();

    // The schema editor lists the entry, but the picker no longer offers it.
    await page.goto(`${schemaUrl}/edit`);
    await expect(schemaEditor.exerciseRow(NAME)).toBeVisible();
    await page.getByRole('button', { name: 'Oefening toevoegen' }).click();
    // Wait for the picker to be populated, so the absence check below isn't vacuous.
    await expect(page.getByRole('button', { name: 'Barbell Bench Press', exact: true })).toBeVisible();
    await page.getByPlaceholder('Zoek oefening...').fill(NAME);
    await expect(page.getByRole('button', { name: `Nieuwe oefening "${NAME}" aanmaken` })).toBeVisible();
    await expect(page.getByRole('button', { name: NAME, exact: true })).toHaveCount(0);
  });

  test('is not offered when adding an exercise to a running workout', async ({
    exerciseForm,
    exercises,
    startWorkout,
    page,
  }) => {
    const NAME = 'E2E Ghost Row';
    await exerciseForm.create(NAME);
    await exercises.goto();
    await exercises.delete(NAME);
    await expect(exercises.card(NAME)).toHaveCount(0);

    await startWorkout.goto();
    await startWorkout.startFree();
    await page.getByRole('button', { name: 'Oefening toevoegen' }).click();
    // Wait for the picker to be populated, so the absence check below isn't vacuous.
    await expect(page.getByRole('button', { name: 'Barbell Bench Press', exact: true })).toBeVisible();
    await page.getByPlaceholder('Zoek oefening...').fill(NAME);
    await expect(page.getByRole('button', { name: `Nieuwe oefening "${NAME}" aanmaken` })).toBeVisible();
    await expect(page.getByRole('button', { name: NAME, exact: true })).toHaveCount(0);
  });
});
