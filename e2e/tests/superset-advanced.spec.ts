import { test, expect } from '../fixtures/app';

const A = 'Barbell Bench Press';
const B = 'Barbell Row';
const C = 'Overhead Press';

test.describe('Supersets — advanced', () => {
  test('a three-exercise superset alternates A→B→C then rests and returns to A', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Triset');
    await schemaEditor.addExercise(A);
    await schemaEditor.addExercise(B);
    await schemaEditor.addExercise(C);
    await schemaEditor.linkWithPrevious(B);
    await schemaEditor.linkWithPrevious(C);
    await schemaEditor.save();

    await startWorkout.goto();
    await startWorkout.start('E2E Triset');

    // A → B (no rest)
    expect(await workout.expandedExerciseName()).toContain(A);
    await workout.completeActiveSet(60, 10);
    await expect(workout.expandedCard.locator('h3').first()).toContainText(B);
    await expect(workout.restTimer).toHaveCount(0);

    // B → C (no rest)
    await workout.completeActiveSet(50, 10);
    await expect(workout.expandedCard.locator('h3').first()).toContainText(C);
    await expect(workout.restTimer).toHaveCount(0);

    // C ends the round: rest starts, focus returns to A.
    await workout.completeActiveSet(40, 10);
    await expect(workout.restTimer).toBeVisible();
    await expect(workout.expandedCard.locator('h3').first()).toContainText(A);
  });

  test('shows supersets on the schema detail page', async ({ schemaEditor, page }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Detail Superset');
    await schemaEditor.addExercise(A);
    await schemaEditor.addExercise(B);
    await schemaEditor.linkWithPrevious(B);
    await schemaEditor.save(); // lands on the detail page

    await expect(page.getByTestId('superset-group')).toHaveCount(1);
    await expect(page.getByText('Superset', { exact: true })).toBeVisible();
  });

  test('moving an exercise between members dissolves the superset', async ({ schemaEditor }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Dissolve');
    await schemaEditor.addExercise(A);
    await schemaEditor.addExercise(B);
    await schemaEditor.addExercise(C);
    await schemaEditor.linkWithPrevious(B); // A+B are a superset; C is separate
    await expect(schemaEditor.supersetGroups).toHaveCount(1);

    // Move C up between A and B — the group is no longer contiguous.
    await schemaEditor.moveUp(C);

    await expect(schemaEditor.supersetGroups).toHaveCount(0);
    await expect(schemaEditor.supersetBadge(A)).toHaveCount(0);
  });
});
