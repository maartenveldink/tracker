import { test, expect } from '../fixtures/app';
import { seedTraining } from '../fixtures/seedTraining';
import type { Page } from '@playwright/test';

const BENCH = 'Barbell Bench Press'; // plates → 1,25 kg weight step
const ROW = 'Barbell Row';

/**
 * Seeds one completed workout: bench 80 kg × 5 and row 60 kg × 8. With the
 * default (Epley) formula a 100 kg × 5 bench goal is then exactly 80%.
 */
async function seedHistory(page: Page): Promise<void> {
  await page.goto('/progress');
  await seedTraining(page, {
    workouts: [
      {
        daysAgo: 2,
        exercises: [
          { name: BENCH, sets: [{ reps: 5, weight: 80 }] },
          { name: ROW, sets: [{ reps: 8, weight: 60 }] },
        ],
      },
    ],
  });
}

test.describe('Exercise goal', () => {
  test('a goal set in the form shows as a progress bar on the history page and records board', async ({
    page,
    exercises,
    exerciseForm,
    progress,
  }) => {
    await seedHistory(page);

    await exercises.goto();
    await exercises.search(BENCH);
    await exercises.open(BENCH);
    await expect(exerciseForm.goalWeight).toHaveValue('');
    await expect(exerciseForm.goalReps).toHaveValue('');
    await exerciseForm.setGoal('100', '5');
    await exerciseForm.save();

    // History page: 80 kg × 5 estimated vs a 100 kg × 5 goal → 80%.
    await progress.goto();
    await progress.openExercise(BENCH);
    await expect(progress.goalBar(BENCH)).toHaveAttribute('aria-valuenow', '80');
    await expect(page.getByText('Doel: 100 kg × 5')).toBeVisible();
    await expect(page.getByText('80%', { exact: true })).toBeVisible();
    await expect(page.getByText('Doel gehaald!')).toHaveCount(0);

    // Records board on the Overzicht tab: same bar; the row (no goal) has none.
    await progress.goto();
    await progress.openTab('Overzicht');
    await expect(progress.goalBar(BENCH)).toHaveAttribute('aria-valuenow', '80');
    await expect(page.getByText(ROW).first()).toBeVisible();
    await expect(progress.goalBar(ROW)).toHaveCount(0);
  });

  test('a reached goal shows the green "Doel gehaald" state and offers a new goal', async ({
    page,
    exercises,
    exerciseForm,
    progress,
  }) => {
    await seedHistory(page);

    await exercises.goto();
    await exercises.search(BENCH);
    await exercises.open(BENCH);
    await exerciseForm.setGoal('75', '5');
    await exerciseForm.save();

    await progress.goto();
    await progress.openTab('Overzicht');
    await expect(progress.goalBar(BENCH)).toHaveAttribute('aria-valuenow', '100');
    await expect(page.getByText('Doel gehaald!')).toBeVisible();

    // "Nieuw doel" opens the exercise form with the current goal filled in.
    await page.getByRole('link', { name: 'Nieuw doel' }).click();
    await page.waitForURL(/\/exercises\/[^/]+\/edit$/);
    await expect(exerciseForm.goalWeight).toHaveValue('75');
    await expect(exerciseForm.goalReps).toHaveValue('5');
    await exerciseForm.setGoal('90', '5');
    await exerciseForm.save();

    await progress.goto();
    await progress.openExercise(BENCH);
    // 80 / 90 = 88,9% → floored to 88, no longer achieved.
    await expect(progress.goalBar(BENCH)).toHaveAttribute('aria-valuenow', '88');
    await expect(page.getByText('Doel gehaald!')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Doel wijzigen' })).toBeVisible();
  });

  test('clearing the goal removes the progress bar', async ({ page, exercises, exerciseForm, progress }) => {
    await seedHistory(page);

    await exercises.goto();
    await exercises.search(BENCH);
    await exercises.open(BENCH);
    await exerciseForm.setGoal('100', '5');
    await exerciseForm.save();

    await exercises.search(BENCH);
    await exercises.open(BENCH);
    await expect(exerciseForm.goalWeight).toHaveValue('100');
    await exerciseForm.clearGoal();
    await expect(exerciseForm.goalWeight).toHaveValue('');
    await expect(exerciseForm.goalReps).toHaveValue('');
    await exerciseForm.save();

    await progress.goto();
    await progress.openExercise(BENCH);
    await expect(page.getByText('Sessies (1)')).toBeVisible(); // history has loaded
    await expect(progress.goalBar(BENCH)).toHaveCount(0);

    await progress.goto();
    await progress.openTab('Overzicht');
    await expect(page.getByText(BENCH).first()).toBeVisible();
    await expect(progress.goalBar(BENCH)).toHaveCount(0);
  });

  test('rejects half-filled or out-of-range goals and steps the weight by the equipment increment', async ({
    page,
    exercises,
    exerciseForm,
  }) => {
    await exercises.goto();
    await exercises.search(BENCH);
    await exercises.open(BENCH);

    await exerciseForm.setGoal('100', '');
    await exerciseForm.submit();
    await expect(exerciseForm.goalError).toContainText('zowel gewicht als herhalingen');
    await expect(page).toHaveURL(/\/edit$/);

    await exerciseForm.setGoal('100', '0');
    await exerciseForm.submit();
    await expect(exerciseForm.goalError).toContainText('heel getal');

    await exerciseForm.setGoal('0', '5');
    await exerciseForm.submit();
    await expect(exerciseForm.goalError).toContainText('Doelgewicht');
    await expect(page).toHaveURL(/\/edit$/);

    // Bench is a plates exercise: the steppers move in 1,25 kg.
    await exerciseForm.setGoal('100', '5');
    await page.getByRole('button', { name: 'Doelgewicht omhoog' }).click();
    await expect(exerciseForm.goalWeight).toHaveValue('101.25');
    await expect(exerciseForm.goalError).toHaveCount(0);
  });

  test('an exercise without a goal still edits and shows no goal bar', async ({
    page,
    exercises,
    exerciseForm,
    progress,
  }) => {
    await seedHistory(page);

    await exercises.goto();
    await exercises.search(ROW);
    await exercises.open(ROW);
    await expect(exerciseForm.goalWeight).toHaveValue('');
    await exerciseForm.save(); // unchanged, no goal: saves normally

    await progress.goto();
    await progress.openExercise(ROW);
    await expect(page.getByText('Geschatte 1RM (kg)')).toBeVisible();
    await expect(page.getByText('Sessies (1)')).toBeVisible();
    await expect(progress.goalBar(ROW)).toHaveCount(0);
  });

  test('the goal survives an export → wipe → import round-trip', async ({
    page,
    exercises,
    exerciseForm,
    settings,
  }, testInfo) => {
    const NAME = 'E2E Goal Curl';
    // Export needs at least one workout/schema; custom exercises alone don't count.
    await seedHistory(page);
    await exerciseForm.gotoNew();
    await exerciseForm.setName(NAME);
    await exerciseForm.setGoal('22.5', '8');
    await exerciseForm.save();

    const file = testInfo.outputPath('goal-export.json');
    await settings.goto();
    await settings.exportTo(file);
    await settings.clearAll();
    await settings.importFrom(file, 'replace');

    await exercises.goto();
    await exercises.search(NAME);
    await exercises.open(NAME);
    await expect(exerciseForm.goalWeight).toHaveValue('22.5');
    await expect(exerciseForm.goalReps).toHaveValue('8');
    await expect(page.locator('#exercise-name')).toHaveValue(NAME);
  });
});
