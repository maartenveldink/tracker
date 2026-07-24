import { test as base } from '@playwright/test';
import { SchemaEditorPage } from '../pages/SchemaEditorPage';
import { SchemasPage } from '../pages/SchemasPage';
import { SchemaDetailPage } from '../pages/SchemaDetailPage';
import { ExercisesPage } from '../pages/ExercisesPage';
import { ExerciseFormPage } from '../pages/ExerciseFormPage';
import { StartWorkoutPage } from '../pages/StartWorkoutPage';
import { WorkoutPage } from '../pages/WorkoutPage';
import { SettingsPage } from '../pages/SettingsPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ProgressPage, WorkoutHistoryPage } from '../pages/ProgressPage';

/**
 * Custom fixtures that hand each test ready-made page objects. Because every
 * Playwright test runs in a fresh browser context, IndexedDB starts empty and
 * re-seeds the default exercises on first load — no manual cleanup needed.
 */
type AppFixtures = {
  exercises: ExercisesPage;
  exerciseForm: ExerciseFormPage;
  schemas: SchemasPage;
  schemaEditor: SchemaEditorPage;
  schemaDetail: SchemaDetailPage;
  startWorkout: StartWorkoutPage;
  workout: WorkoutPage;
  settings: SettingsPage;
  dashboard: DashboardPage;
  progress: ProgressPage;
  history: WorkoutHistoryPage;
};

export const test = base.extend<AppFixtures>({
  exercises: async ({ page }, use) => {
    await use(new ExercisesPage(page));
  },
  exerciseForm: async ({ page }, use) => {
    await use(new ExerciseFormPage(page));
  },
  schemas: async ({ page }, use) => {
    await use(new SchemasPage(page));
  },
  schemaEditor: async ({ page }, use) => {
    await use(new SchemaEditorPage(page));
  },
  schemaDetail: async ({ page }, use) => {
    await use(new SchemaDetailPage(page));
  },
  startWorkout: async ({ page }, use) => {
    await use(new StartWorkoutPage(page));
  },
  workout: async ({ page }, use) => {
    await use(new WorkoutPage(page));
  },
  settings: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
  dashboard: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  progress: async ({ page }, use) => {
    await use(new ProgressPage(page));
  },
  history: async ({ page }, use) => {
    await use(new WorkoutHistoryPage(page));
  },
});

export { expect } from '@playwright/test';
