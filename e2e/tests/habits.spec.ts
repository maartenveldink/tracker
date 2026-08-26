import { test, expect } from '../fixtures/app';

/** Our weekday index for today: 0=Mon … 6=Sun. */
function todayWeekday(): number {
  return (new Date().getDay() + 6) % 7;
}

test.describe('Habit tracker', () => {
  test('creates a daily habit, ticks it off and builds a streak', async ({ habits }) => {
    await habits.create({ name: 'Water drinken', emoji: '💧', schedule: { kind: 'daily' } });

    await expect(habits.row('Water drinken')).toBeVisible();
    await habits.toggle('Water drinken');

    // Done today → the checkbox is pressed and the streak shows 1.
    await expect(habits.row('Water drinken').getByRole('button', { name: /Afvink/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(habits.row('Water drinken')).toContainText('1');
  });

  test('counts a counter habit up to its target', async ({ habits }) => {
    await habits.create({ name: 'Stappen', type: 'count', target: 3, schedule: { kind: 'daily' } });

    const row = habits.row('Stappen');
    await expect(row).toContainText('0/3');
    await habits.increment('Stappen');
    await habits.increment('Stappen');
    await habits.increment('Stappen');
    await expect(row).toContainText('3/3');
  });

  test('a weekday habit shows only on its scheduled days', async ({ habits }) => {
    const other = (todayWeekday() + 1) % 7; // a weekday that is not today

    await habits.create({ name: 'Niet vandaag', schedule: { kind: 'weekdays', days: [other] } });
    await expect(habits.row('Niet vandaag')).toHaveCount(0);

    await habits.create({ name: 'Wel vandaag', schedule: { kind: 'weekdays', days: [todayWeekday()] } });
    await expect(habits.row('Wel vandaag')).toBeVisible();
  });

  test('reorders habits with the up control', async ({ habits }) => {
    await habits.create({ name: 'Eerste', schedule: { kind: 'daily' } });
    await habits.create({ name: 'Tweede', schedule: { kind: 'daily' } });

    // Initial order: Eerste, Tweede.
    await expect(habits.rows.nth(0)).toContainText('Eerste');

    await habits.moveUp('Tweede');
    await expect(habits.rows.nth(0)).toContainText('Tweede');
    await expect(habits.rows.nth(1)).toContainText('Eerste');
  });

  test('exports habits and restores them after a wipe', async ({ habits, settings, page }, testInfo) => {
    await habits.create({ name: 'Mediteren', schedule: { kind: 'daily' } });
    await habits.toggle('Mediteren'); // a log to round-trip too

    // Export → capture the downloaded JSON.
    await settings.goto();
    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exporteer data' }).click(),
    ]).then(([d]) => d);
    const file = testInfo.outputPath('habits-export.json');
    await download.saveAs(file);

    // Wipe everything, confirm the habit is gone.
    await settings.clearAll();
    await habits.goto();
    await expect(habits.row('Mediteren')).toHaveCount(0);

    // Import (replace) → habit and its log return.
    await settings.goto();
    await page.locator('input[type="file"]').setInputFiles(file);
    await page.getByRole('button', { name: /Vervangen/ }).click();
    await page.getByRole('button', { name: 'Sluiten' }).click();

    await habits.goto();
    await expect(habits.row('Mediteren')).toBeVisible();
    // The log survived: the habit is still ticked today.
    await expect(habits.row('Mediteren').getByRole('button', { name: /Afvink/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('the dashboard shows today\'s habits and lets you check them off', async ({ habits, page }) => {
    await habits.create({ name: 'Stretchen', schedule: { kind: 'daily' } });

    await page.goto('/');
    const card = page.locator('div').filter({ hasText: /^Habits vandaag/ }).first();
    await expect(page.getByText('Habits vandaag')).toBeVisible();
    await expect(page.getByText('Stretchen')).toBeVisible();

    await page.getByRole('button', { name: 'Afvinken', exact: true }).click();
    await expect(card).toContainText('1/1');
  });
});
