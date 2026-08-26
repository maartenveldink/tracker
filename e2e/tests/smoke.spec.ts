import { test, expect } from '../fixtures/app';

/**
 * A minimal smoke test: the app boots, seeds its data and renders the shell.
 * Catches white-screen regressions (bad build, failed seed, router crash).
 */
test('app boots and shows the bottom navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Train' })).toBeVisible();
});

test('the "Meer" menu reaches the secondary destinations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Meer' }).click();

  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('button', { name: 'Oefeningen' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: "Schema's" })).toBeVisible();

  await sheet.getByRole('button', { name: 'Instellingen' }).click();
  await expect(page).toHaveURL(/\/settings$/);
});
