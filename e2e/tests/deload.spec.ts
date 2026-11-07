import { test, expect } from '../fixtures/app';
import { seedTraining, type SeedWorkout } from '../fixtures/seedTraining';

const BENCH = 'Barbell Bench Press';
const ROW = 'Barbell Row';
const SQUAT = 'Barbell Back Squat';

/** One workout per entry of `daysAgo`, each with the given weight (8 reps). */
function series(name: string, daysAgo: number[], weights: number[]): SeedWorkout[] {
  return daysAgo.map((d, i) => ({
    daysAgo: d,
    exercises: [{ name, sets: [{ reps: 8, weight: weights[i]! }] }],
  }));
}

// Sessions 21/14/7/0 days ago → exactly four consecutive ISO weeks, any weekday.
const WEEKS = [21, 14, 7, 0];

test.describe('Deload detection', () => {
  test('suggests a deload when several exercises stagnate or decline', async ({ dashboard, page }) => {
    await dashboard.goto();
    await seedTraining(page, {
      workouts: [
        ...series(BENCH, WEEKS, [70, 70, 70, 70]), // flat
        ...series(ROW, WEEKS, [60, 62.5, 60, 57.5]), // declining
        ...series(SQUAT, WEEKS, [80, 85, 90, 95]), // rising: not listed
      ],
    });
    await dashboard.goto();

    await expect(dashboard.deloadCard).toBeVisible();
    await expect(dashboard.deloadCard).toContainText('Overweeg een deload-week');
    await expect(dashboard.deloadCard).toContainText(BENCH);
    await expect(dashboard.deloadCard).toContainText(ROW);
    await expect(dashboard.deloadCard).not.toContainText(SQUAT);
  });

  test('stays quiet while the 1RM keeps rising', async ({ dashboard, page }) => {
    await dashboard.goto();
    await seedTraining(page, {
      workouts: [
        ...series(BENCH, WEEKS, [60, 62.5, 65, 67.5]),
        ...series(ROW, WEEKS, [50, 52.5, 55, 57.5]),
      ],
    });
    await dashboard.goto();

    await expect(dashboard.streak).toHaveText('4'); // data has loaded
    await expect(dashboard.deloadCard).toHaveCount(0);
  });

  test('stays quiet with too little data or a single stagnating exercise', async ({ dashboard, page }) => {
    await dashboard.goto();
    await seedTraining(page, {
      workouts: [
        // Only two weeks of history: not enough to judge.
        ...series(BENCH, [7, 0], [70, 70]),
        ...series(ROW, [7, 0], [60, 60]),
        // Enough history, but only this one exercise stalls (below the
        // "at least two" threshold).
        ...series(SQUAT, WEEKS, [90, 90, 90, 90]),
      ],
    });
    await dashboard.goto();

    await expect(dashboard.streak).toHaveText('4');
    await expect(dashboard.deloadCard).toHaveCount(0);
  });

  test('stays quiet when only a minority of exercises stalls', async ({ dashboard, page }) => {
    await dashboard.goto();
    await seedTraining(page, {
      workouts: [
        ...series(BENCH, WEEKS, [70, 70, 70, 70]),
        ...series(ROW, WEEKS, [60, 60, 60, 60]),
        ...series(SQUAT, WEEKS, [80, 85, 90, 95]),
        ...series('Conventional Deadlift', WEEKS, [100, 105, 110, 115]),
        ...series('Overhead Press', WEEKS, [40, 42.5, 45, 47.5]),
      ],
    });
    await dashboard.goto();

    await expect(dashboard.streak).toHaveText('4');
    await expect(dashboard.deloadCard).toHaveCount(0); // 2 of 5 < half
  });

  test('stays quiet when a deload is already underway', async ({ dashboard, page }) => {
    await dashboard.goto();
    await seedTraining(page, {
      workouts: [
        ...series(BENCH, WEEKS, [70, 70, 70, 55]),
        ...series(ROW, WEEKS, [60, 60, 60, 45]),
      ],
    });
    await dashboard.goto();

    await expect(dashboard.streak).toHaveText('4');
    await expect(dashboard.deloadCard).toHaveCount(0);
  });

  test('stays quiet right after a longer pause', async ({ dashboard, page }) => {
    await dashboard.goto();
    await seedTraining(page, {
      workouts: [
        // Strong history, a 3-week break, then back with lighter weights: only
        // two weeks since the restart.
        ...series(BENCH, [35, 28, 7, 0], [80, 80, 60, 60]),
        ...series(ROW, [35, 28, 7, 0], [70, 70, 50, 50]),
      ],
    });
    await dashboard.goto();

    await expect(dashboard.streak).toHaveText('2'); // data has loaded
    await expect(dashboard.deloadCard).toHaveCount(0);
  });

  test('can be hidden for a week', async ({ dashboard, page }) => {
    await dashboard.goto();
    await seedTraining(page, {
      workouts: [
        ...series(BENCH, WEEKS, [70, 70, 70, 70]),
        ...series(ROW, WEEKS, [60, 60, 60, 60]),
      ],
    });
    await dashboard.goto();
    await expect(dashboard.deloadCard).toBeVisible();

    await dashboard.hideDeloadButton.click();
    await expect(dashboard.deloadCard).toHaveCount(0);

    // The snooze is stored device-locally and survives a reload.
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('tracker.deload.dismissedUntil')))
      .not.toBeNull();
    await page.reload();
    await expect(dashboard.streak).toHaveText('4');
    await expect(dashboard.deloadCard).toHaveCount(0);
  });

  test('clear-all removes the device-local snooze', async ({ dashboard, settings, page }) => {
    await dashboard.goto();
    await seedTraining(page, {
      workouts: [
        ...series(BENCH, WEEKS, [70, 70, 70, 70]),
        ...series(ROW, WEEKS, [60, 60, 60, 60]),
      ],
    });
    await dashboard.goto();
    await dashboard.hideDeloadButton.click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('tracker.deload.dismissedUntil')))
      .not.toBeNull();

    await settings.goto();
    await settings.clearAll();
    expect(await page.evaluate(() => localStorage.getItem('tracker.deload.dismissedUntil'))).toBeNull();
  });
});
