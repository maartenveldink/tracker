import { test, expect } from '../fixtures/app';

test.describe('Exercise library', () => {
  test('creates a custom exercise', async ({ exerciseForm, exercises }) => {
    await exerciseForm.create('E2E Push-up', 'Bodyweight test exercise');

    await exercises.goto();
    await expect(exercises.card('E2E Push-up')).toBeVisible();
  });

  test('search filters the exercise list', async ({ exercises }) => {
    await exercises.goto();
    // Two seeded exercises that don't share a word.
    await expect(exercises.card('Barbell Bench Press')).toBeVisible();
    await expect(exercises.card('Conventional Deadlift')).toBeVisible();

    await exercises.search('Deadlift');

    await expect(exercises.card('Conventional Deadlift')).toBeVisible();
    await expect(exercises.card('Barbell Bench Press')).toHaveCount(0);
  });

  test('edits an existing exercise', async ({ exerciseForm, exercises }) => {
    await exerciseForm.create('E2E Temp');

    await exercises.goto();
    await exercises.open('E2E Temp');
    await exerciseForm.setName('E2E Renamed');
    await exerciseForm.save();

    await expect(exercises.card('E2E Renamed')).toBeVisible();
    await expect(exercises.card('E2E Temp')).toHaveCount(0);
  });

  test('a list row opens the detail page, which links to the edit form', async ({
    page,
    exerciseForm,
    exercises,
  }) => {
    await exerciseForm.create('E2E Detail', 'Notitie voor detail');

    await exercises.goto();
    await exercises.openDetail('E2E Detail');

    await expect(page.getByTestId('exercise-info')).toContainText('Notitie voor detail');
    await expect(page.getByText('Nog geen gelogde sets')).toBeVisible();

    await page.getByRole('link', { name: 'Bewerk E2E Detail' }).click();
    await expect(page).toHaveURL(/\/exercises\/[^/]+\/edit$/);
  });

  test('deletes a custom exercise', async ({ exerciseForm, exercises }) => {
    await exerciseForm.create('E2E Deletable');

    await exercises.goto();
    await expect(exercises.card('E2E Deletable')).toBeVisible();
    await exercises.delete('E2E Deletable');

    await expect(exercises.card('E2E Deletable')).toHaveCount(0);
  });

  test('merges an exercise into another, moving its logged history', async ({
    schemaEditor,
    startWorkout,
    workout,
    exercises,
    progress,
    page,
  }) => {
    const SOURCE = 'Barbell Bench Press';
    const TARGET = 'Incline Dumbbell Press';

    // Log a workout for SOURCE so there is history to move.
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Merge schema');
    await schemaEditor.addExercise(SOURCE);
    await schemaEditor.save();
    await startWorkout.goto();
    await startWorkout.start('E2E Merge schema');
    await workout.completeActiveSet(60, 10);
    await workout.finish();

    // Merge SOURCE into TARGET.
    await exercises.goto();
    await exercises.mergeInto(SOURCE, TARGET);

    // SOURCE is gone from the library…
    await exercises.search(SOURCE);
    await expect(exercises.card(SOURCE)).toHaveCount(0);

    // …and the logged session now lives under TARGET in the records board.
    await progress.goto();
    await progress.openTab('Overzicht');
    await expect(page.getByText(TARGET).first()).toBeVisible();
    await expect(page.getByText(SOURCE)).toHaveCount(0);
  });
});
