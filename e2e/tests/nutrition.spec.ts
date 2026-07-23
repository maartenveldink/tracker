import { test, expect } from '../fixtures/app';

test.describe('Nutrition module (optional)', () => {
  test('creates a food after enabling the module', async ({ settings, foods }) => {
    await settings.goto();
    await settings.toggleFeature('nutrition');

    await foods.createFood('E2E Chicken');
    await expect(foods.card('E2E Chicken')).toBeVisible();
  });
});
