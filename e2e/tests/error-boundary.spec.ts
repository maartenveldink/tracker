import { test, expect } from '../fixtures/app';

/**
 * A failing lazy chunk used to leave a blank screen. The error boundary now shows a
 * message with a reload button. In e2e there is no signed-in user, so the technical
 * details (shown only to the diagnostics user) must stay hidden.
 */
test('a failing page chunk shows the error screen instead of a blank page', async ({ page, context }) => {
  // Matches the dev module (ProgressPage.tsx) and the built chunk (ProgressPage-<hash>.js).
  await context.route('**/*ProgressPage*', route => route.abort());

  await page.goto('/');
  await page.getByRole('link', { name: 'Progressie' }).click();

  await expect(page.getByRole('heading', { name: 'Er ging iets mis' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Opnieuw laden' })).toBeVisible();
});

test('the error screen hides technical details from other users', async ({ page, context }) => {
  await context.route('**/*ProgressPage*', route => route.abort());

  await page.goto('/progress');

  await expect(page.getByRole('heading', { name: 'Er ging iets mis' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kopieer foutrapport' })).toHaveCount(0);
  await expect(page.getByLabel('Foutrapport')).toHaveCount(0);
});
