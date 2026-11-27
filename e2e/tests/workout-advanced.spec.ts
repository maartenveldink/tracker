import { test, expect } from '../fixtures/app';

const A = 'Barbell Bench Press';

async function simpleSchema(
  schemaEditor: import('../pages/SchemaEditorPage').SchemaEditorPage,
  name: string,
) {
  await schemaEditor.gotoNew();
  await schemaEditor.setName(name);
  await schemaEditor.addExercise(A);
  await schemaEditor.save();
}

test.describe('Live workout — advanced', () => {
  test('adds and removes sets', async ({ schemaEditor, startWorkout, workout }) => {
    await simpleSchema(schemaEditor, 'E2E Sets');
    await startWorkout.goto();
    await startWorkout.start('E2E Sets');

    await expect.poll(() => workout.setCount()).toBe(3); // default
    await workout.addSet();
    await expect.poll(() => workout.setCount()).toBe(4);

    await workout.removeLastSet();
    await expect.poll(() => workout.setCount()).toBe(3);
  });

  test('has no set limit; the set row scrolls and follows the opened set', async ({ page, schemaEditor, startWorkout, workout }) => {
    await simpleSchema(schemaEditor, 'E2E Many');
    await startWorkout.goto();
    await startWorkout.start('E2E Many');

    await workout.completeActiveSet(60, 10);
    for (let n = 4; n <= 12; n++) {
      await workout.addSet();
      await expect.poll(() => workout.setCount()).toBe(n);
    }
    // Past the old maximum of 8 the plus dot is still there and the row starts right-aligned.
    const plus = page.getByRole('button', { name: 'Set toevoegen' });
    await expect(plus).toBeInViewport({ ratio: 0.9 });
    await expect(workout.setDots.nth(11)).toHaveAttribute('aria-pressed', 'true');
    await expect(workout.setDots.nth(11)).toBeInViewport({ ratio: 0.9 });
    await expect(workout.setDots.first()).not.toBeInViewport();

    // Opening set 1 via the Gedaan list scrolls the row to it.
    await workout.doneRows.first().click();
    await expect(workout.setDots.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(workout.setDots.first()).toBeInViewport({ ratio: 0.9 });
  });

  test('shows the rest ring after a set; the rest bar shortens it by 15 seconds', async ({ schemaEditor, startWorkout, workout }) => {
    await simpleSchema(schemaEditor, 'E2E Rest');
    await startWorkout.goto();
    await startWorkout.start('E2E Rest');

    await workout.completeActiveSet(60, 10);
    await expect(workout.restTimer).toBeVisible();
    await expect(workout.restTimer).toBeInViewport();

    const before = await workout.restSeconds();
    await workout.openRestBar();
    await workout.adjustRest('shorter');
    await workout.closeRestBar();
    // Closing a bar on a running rest does not restart it; the countdown keeps running.
    await expect(workout.restTimer).toBeVisible();
    expect(await workout.restSeconds()).toBeLessThanOrEqual(before - 15);
  });

  test('creates a brand-new exercise mid-workout and adds it', async ({
    startWorkout,
    workout,
    exercises,
    page,
  }) => {
    const NEW = 'E2E Kettlebell Swing';

    await startWorkout.goto();
    await startWorkout.startFree();

    // The exercise does not exist yet — create it in full from the sheet.
    await workout.createAndAddExercise(NEW, 'Explosieve hip hinge');

    // It becomes the current exercise and can be logged like any other exercise.
    await expect(workout.currentTitle).toHaveText(NEW);
    await workout.completeActiveSet(24, 12);
    await workout.finish();
    await expect(page.getByRole('heading', { name: 'Samenvatting' })).toBeVisible();

    // It was really persisted as a reusable exercise, not just added to the log.
    await exercises.goto();
    await expect(page.getByText(NEW, { exact: true })).toBeVisible();
  });

  test('does NOT bump the weight when a set falls short of the target', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await simpleSchema(schemaEditor, 'E2E NoBump'); // default 3×10

    await startWorkout.goto();
    await startWorkout.start('E2E NoBump');
    await workout.completeActiveSet(60, 10);
    await workout.logActiveReps(10);
    await workout.logActiveReps(8); // last set below the target of 10
    await workout.finish();

    // Next session keeps the same weight (no progression).
    await startWorkout.goto();
    await startWorkout.start('E2E NoBump');
    await expect(workout.weightInput).toHaveValue('60');
  });
});
