import { test, expect } from '../fixtures/app';
import { seedTraining } from '../fixtures/seedTraining';
import { fixDate } from '../fixtures/fixedDate';

const A = 'Barbell Bench Press';
const oneSet = { name: A, sets: [{ reps: 8, weight: 60 }] };

test.describe('Training streak', () => {
  test('counts consecutive weeks even with older workouts in weeks 1-9 and 10+', async ({ dashboard, page }) => {
    // Saturday of ISO week 45 of 2026. Streak = weeks 45, 44, 43; the older
    // weeks 11 and 7 are not consecutive and must not break the "most recent"
    // detection (week keys used to sort as text, so "W7" > "W45").
    await fixDate(page, '2026-11-07T12:00:00');
    await dashboard.goto();
    await seedTraining(page, {
      workouts: [0, 7, 14, 238, 266].map(daysAgo => ({ daysAgo, exercises: [oneSet] })),
    });
    await dashboard.goto();

    await expect(dashboard.streak).toHaveText('3');
  });

  test('keeps counting across the year boundary into a 53-week year', async ({ dashboard, page }) => {
    // 2026 has 53 ISO weeks: W52 (22 Dec), W53 (29 Dec), then W1 of 2027.
    await fixDate(page, '2027-01-05T12:00:00');
    await dashboard.goto();
    await seedTraining(page, {
      workouts: [0, 7, 14, 21].map(daysAgo => ({ daysAgo, exercises: [oneSet] })),
    });
    await dashboard.goto();

    await expect(dashboard.streak).toHaveText('4');
  });

  test('tolerates a missing current week as long as last week has a workout', async ({ dashboard, page }) => {
    await fixDate(page, '2026-11-07T12:00:00');
    await dashboard.goto();
    await seedTraining(page, {
      workouts: [7, 14].map(daysAgo => ({ daysAgo, exercises: [oneSet] })),
    });
    await dashboard.goto();

    await expect(dashboard.streak).toHaveText('2');
  });
});
