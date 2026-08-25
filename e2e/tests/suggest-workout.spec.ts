import { test, expect } from '../fixtures/app';

test.describe('Suggested workout', () => {
  test('suggests a full-body workout on a cold start and starts it', async ({
    startWorkout,
    suggest,
    page,
  }) => {
    await startWorkout.goto();
    await startWorkout.openSuggestion();

    await expect(suggest.heading).toBeVisible();
    // No history yet, so the fallback spreads across muscle groups.
    await expect(suggest.rows.first()).toBeVisible();
    expect(await suggest.count()).toBeGreaterThan(0);

    await suggest.start();
    await expect(page.getByTestId('exercise-card').first()).toBeVisible();
  });

  test('a longer target duration is reflected in the label', async ({ startWorkout, suggest }) => {
    await startWorkout.goto();
    await startWorkout.openSuggestion();

    await expect(suggest.targetLabel).toHaveText('45 min');
    await suggest.longer();
    await expect(suggest.targetLabel).toHaveText('50 min');
  });

  test('adds an extra exercise to the suggestion', async ({ startWorkout, suggest, page }) => {
    await startWorkout.goto();
    await startWorkout.openSuggestion();

    await expect(suggest.rows.first()).toBeVisible();
    const before = await suggest.count();
    const added = await suggest.addFirstAvailable();

    await expect(suggest.rows).toHaveCount(before + 1);
    await expect(page.getByText(added, { exact: true })).toBeVisible();
  });

  test('offers similar exercises when swapping', async ({ startWorkout, suggest }) => {
    await startWorkout.goto();
    await startWorkout.openSuggestion();

    await suggest.openSwapFirst();
    await expect(suggest.swapSheetTitle).toBeVisible();
  });
});
