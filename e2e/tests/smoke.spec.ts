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
