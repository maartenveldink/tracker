import { test, expect } from '../fixtures/app';

test.describe('Planner module (optional)', () => {
  test('creates a week plan after enabling the module', async ({ settings, planner }) => {
    await settings.goto();
    await settings.toggleFeature('planner');

    await planner.createPlan('E2E Week A');
    await planner.openManage();
    await expect(planner.card('E2E Week A')).toBeVisible();
  });
});
