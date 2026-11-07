import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures/app';
import { seedTraining, type SeedWorkout } from '../fixtures/seedTraining';
import { fixDate } from '../fixtures/fixedDate';

const BENCH = 'Barbell Bench Press';
const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

/** One bench set of 8 × 50 kg = 400 kg volume. */
function workout(daysAgo: number, extra: Partial<SeedWorkout> = {}): SeedWorkout {
  return { daysAgo, exercises: [{ name: BENCH, sets: [{ reps: 8, weight: 50 }] }], ...extra };
}

/** Asserts the cell sits in weekday column `index` (0 = ma … 6 = zo), judged by x position. */
async function expectColumn(page: Page, cell: Locator, index: number): Promise<void> {
  const header = page.getByRole('group', { name: 'Trainingskalender' }).getByText(WEEKDAYS[index]!, { exact: true });
  await expect(async () => {
    const h = await header.boundingBox();
    const c = await cell.boundingBox();
    expect(h).not.toBeNull();
    expect(c).not.toBeNull();
    const headerCentre = h!.x + h!.width / 2;
    expect(Math.abs(c!.x + c!.width / 2 - headerCentre)).toBeLessThan(c!.width / 2);
  }).toPass();
}

test.describe('Training calendar', () => {
  // Pinned to Saturday 7 Nov 2026, 12:00 local.
  test.beforeEach(async ({ page }) => {
    await fixDate(page, '2026-11-07T12:00:00');
  });

  test('marks training days in the current month', async ({ progress, page }) => {
    await progress.goto();
    await seedTraining(page, {
      workouts: [
        workout(0, { schemaName: 'Push', dayName: 'Dag A' }), // 7 Nov 12:00
        workout(2), // 5 Nov 12:00
        workout(2.1), // 5 Nov ~09:36: second session the same day
        workout(15), // 23 Oct: previous month
      ],
    });
    await progress.goto();
    await progress.openTab('Overzicht');

    await expect(progress.calendarMonth).toHaveText('november 2026');
    await expect(progress.calendarDay('7 november')).toHaveAccessibleName('7 november, 1 training');
    await expect(progress.calendarDay('5 november')).toHaveAccessibleName('5 november, 2 trainingen');
    await expect(progress.calendarDay('6 november')).toHaveAccessibleName('6 november, geen training');
    await expect(progress.calendarDay('7 november')).toHaveAttribute('aria-current', 'date');
    await expect(progress.calendarDay('6 november')).not.toHaveAttribute('aria-current', 'date');
    // Nothing is open until a day is tapped.
    await expect(progress.calendarDetails).toHaveCount(0);
  });

  test('navigates to the previous month and back to today', async ({ progress, page }) => {
    await progress.goto();
    await seedTraining(page, { workouts: [workout(0), workout(15)] });
    await progress.goto();
    await progress.openTab('Overzicht');

    await progress.calendarPrevious();
    await expect(progress.calendarMonth).toHaveText('oktober 2026');
    await expect(progress.calendarDay('23 oktober')).toHaveAccessibleName('23 oktober, 1 training');
    await expect(progress.calendarDay('7 oktober')).toHaveAccessibleName('7 oktober, geen training');

    await progress.calendarToday();
    await expect(progress.calendarMonth).toHaveText('november 2026');
    // In the current month both "Vandaag" and "Volgende maand" are inert (but stay focusable).
    await expect(page.getByRole('button', { name: 'Volgende maand' })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: 'Vandaag', exact: true })).toHaveAttribute('aria-disabled', 'true');
    // Playwright treats aria-disabled as not actionable, so force the click.
    await page.getByRole('button', { name: 'Volgende maand' }).click({ force: true });
    await expect(progress.calendarMonth).toHaveText('november 2026');
  });

  test('tapping a day shows its sessions and links to the summary', async ({ progress, page }) => {
    await progress.goto();
    await seedTraining(page, {
      workouts: [workout(0, { schemaName: 'Push', dayName: 'Dag A' }), workout(2), workout(2.1)],
    });
    await progress.goto();
    await progress.openTab('Overzicht');

    // Two free sessions on 5 Nov.
    await progress.calendarDay('5 november').click();
    await expect(progress.calendarDetails.getByRole('link')).toHaveCount(2);
    await expect(progress.calendarDetails).toContainText('Vrije training');
    await expect(progress.calendarDetails).toContainText('09:36');
    await expect(progress.calendarDetails).toContainText('12:00');
    await expect(progress.calendarDetails).toContainText('55 min'); // seedTraining completes after 55 min
    await expect(progress.calendarDetails).toContainText('1 oefening');
    await expect(progress.calendarDetails).toContainText('400 kg');

    // Switching day replaces the details; the schema/day name is shown.
    await progress.calendarDay('7 november').click();
    await expect(progress.calendarDetails.getByRole('link')).toHaveCount(1);
    await expect(progress.calendarDetails).toContainText('Push — Dag A');

    await progress.calendarDetails.getByRole('link').click();
    await expect(page).toHaveURL(/\/workout\/[^/]+\/summary$/);
  });

  test('a day without training shows no sessions', async ({ progress, page }) => {
    await progress.goto();
    await seedTraining(page, { workouts: [workout(0)] });
    await progress.goto();
    await progress.openTab('Overzicht');
    await expect(progress.calendarDay('7 november')).toHaveAccessibleName('7 november, 1 training');

    await progress.calendarDay('6 november').click();
    await expect(progress.calendarDetails).toContainText('Geen training op 6 november');
    await expect(progress.calendarDetails.getByRole('link')).toHaveCount(0);
  });

  test('ignores deleted workouts', async ({ progress, history, page }) => {
    await progress.goto();
    // Seeded order is oldest-last in the list; the newest (today) is the first history row.
    await seedTraining(page, { workouts: [workout(0), workout(1)] });
    await history.goto();
    await history.deleteFirst(); // removes today's workout
    await expect(history.entries).toHaveCount(1);

    await progress.goto();
    await progress.openTab('Overzicht');
    // Yesterday (kept) proves the data has loaded; only then is today's absence meaningful.
    await expect(progress.calendarDay('6 november')).toHaveAccessibleName('6 november, 1 training');
    await expect(progress.calendarDay('7 november')).toHaveAccessibleName('7 november, geen training');
  });

  test('selection toggles and resets when changing month', async ({ progress, page }) => {
    await progress.goto();
    await seedTraining(page, { workouts: [workout(0)] });
    await progress.goto();
    await progress.openTab('Overzicht');

    await progress.calendarDay('7 november').click();
    await expect(progress.calendarDetails).toBeVisible();
    await progress.calendarDay('7 november').click();
    await expect(progress.calendarDetails).toHaveCount(0);

    await progress.calendarDay('7 november').click();
    await expect(progress.calendarDetails).toBeVisible();
    await progress.calendarPrevious();
    await expect(progress.calendarDetails).toHaveCount(0);
  });

  test('closing the summary returns to the Overzicht tab', async ({ progress, page }) => {
    await progress.goto();
    await seedTraining(page, { workouts: [workout(0)] });
    await progress.goto();
    await progress.openTab('Overzicht');

    await progress.calendarDay('7 november').click();
    await progress.calendarDetails.getByRole('link').click();
    await expect(page).toHaveURL(/\/summary$/);
    await page.getByRole('button', { name: 'Sluiten' }).click();
    await expect(page).toHaveURL(/\/progress/);
    await expect(progress.calendarMonth).toHaveText('november 2026');
  });
});

test.describe('Training calendar month grid', () => {
  test('rolls over the year boundary', async ({ progress, page }) => {
    await fixDate(page, '2027-01-05T12:00:00');
    await progress.goto();
    await seedTraining(page, { workouts: [workout(5)] }); // 31 Dec 2026
    await progress.goto();
    await progress.openTab('Overzicht');

    await expect(progress.calendarMonth).toHaveText('januari 2027');
    await progress.calendarPrevious();
    await expect(progress.calendarMonth).toHaveText('december 2026');
    await expect(progress.calendarDays).toHaveCount(31);
    await expect(progress.calendarDay('31 december')).toHaveAccessibleName('31 december, 1 training');
    await progress.calendarNext();
    await expect(progress.calendarMonth).toHaveText('januari 2027');
  });

  test('has 29 days in February of a leap year', async ({ progress, page }) => {
    await fixDate(page, '2028-03-05T12:00:00');
    await progress.goto();
    await progress.openTab('Overzicht');
    await progress.calendarPrevious();

    await expect(progress.calendarMonth).toHaveText('februari 2028');
    await expect(progress.calendarDays).toHaveCount(29);
    await expect(progress.calendarDay('29 februari')).toBeVisible();
  });

  test('has 28 days in February of a common year, starting on a Monday', async ({ progress, page }) => {
    await fixDate(page, '2027-03-05T12:00:00'); // 1 Feb 2027 is a Monday
    await progress.goto();
    await progress.openTab('Overzicht');
    await progress.calendarPrevious();

    await expect(progress.calendarMonth).toHaveText('februari 2027');
    await expect(progress.calendarDays).toHaveCount(28);
    // Monday start: no leading padding, so the 1st sits in the "ma" column.
    await expectColumn(page, progress.calendarDay('1 februari'), 0);
    await expectColumn(page, progress.calendarDay('7 februari'), 6);
  });

  test('places a month starting on a Sunday in the "zo" column', async ({ progress, page }) => {
    await fixDate(page, '2026-03-05T12:00:00'); // 1 Feb 2026 is a Sunday
    await progress.goto();
    await progress.openTab('Overzicht');
    await progress.calendarPrevious();

    await expect(progress.calendarMonth).toHaveText('februari 2026');
    await expect(progress.calendarDays).toHaveCount(28);
    await expectColumn(page, progress.calendarDay('1 februari'), 6);
    await expectColumn(page, progress.calendarDay('2 februari'), 0);
  });
});
