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

  test('deletes a custom exercise', async ({ exerciseForm, exercises }) => {
    await exerciseForm.create('E2E Deletable');

    await exercises.goto();
    await expect(exercises.card('E2E Deletable')).toBeVisible();
    await exercises.delete('E2E Deletable');

    await expect(exercises.card('E2E Deletable')).toHaveCount(0);
  });
});
