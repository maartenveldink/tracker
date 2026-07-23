import { test as base } from '@playwright/test';
import { SchemaEditorPage } from '../pages/SchemaEditorPage';
import { StartWorkoutPage } from '../pages/StartWorkoutPage';
import { WorkoutPage } from '../pages/WorkoutPage';

/**
 * Custom fixtures that hand each test ready-made page objects. Because every
 * Playwright test runs in a fresh browser context, IndexedDB starts empty and
 * re-seeds the default exercises on first load — no manual cleanup needed.
 */
type AppFixtures = {
  schemaEditor: SchemaEditorPage;
  startWorkout: StartWorkoutPage;
  workout: WorkoutPage;
};

export const test = base.extend<AppFixtures>({
  schemaEditor: async ({ page }, use) => {
    await use(new SchemaEditorPage(page));
  },
  startWorkout: async ({ page }, use) => {
    await use(new StartWorkoutPage(page));
  },
  workout: async ({ page }, use) => {
    await use(new WorkoutPage(page));
  },
});

export { expect } from '@playwright/test';
