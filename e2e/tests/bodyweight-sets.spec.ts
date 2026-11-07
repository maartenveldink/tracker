import { test, expect } from '../fixtures/app';
import { seedTraining } from '../fixtures/seedTraining';

test.describe('Bodyweight sets (no external weight)', () => {
  test('a pull-up workout without weight still credits the muscle group on the summary', async ({
    dashboard,
    page,
  }) => {
    await dashboard.goto();
    await seedTraining(page, {
      workouts: [
        {
          daysAgo: 0,
          exercises: [{ name: 'Pull-up', sets: [{ reps: 8, weight: null }, { reps: 7, weight: 0 }] }],
        },
      ],
    });

    // Seeded workout ids are deterministic (see seedTraining).
    await page.goto('/workout/seed00000000001/summary');

    // Volume in kg is 0, but the muscle group is listed instead of vanishing.
    await expect(page.getByRole('heading', { name: 'Volume per spiergroep' })).toBeVisible();
    await expect(page.getByText('Rug', { exact: true })).toBeVisible();
    await expect(page.getByText('0 kg', { exact: true }).first()).toBeVisible();
  });

  test('the suggestion counts bodyweight sets as training for that muscle group', async ({
    startWorkout,
    suggest,
    page,
  }) => {
    await startWorkout.goto();
    await seedTraining(page, {
      workouts: [
        {
          daysAgo: 1,
          exercises: [{ name: 'Pull-up', sets: [1, 2, 3].map(() => ({ reps: 8, weight: null })) }],
        },
      ],
    });
    await startWorkout.goto();
    await startWorkout.openSuggestion();
    await expect(suggest.rows.first()).toBeVisible();

    // Back was trained yesterday (3 bodyweight sets) so it is no longer "nog niet getraind".
    await expect(page.getByText('Rug · nog niet getraind')).toHaveCount(0);
  });
});
