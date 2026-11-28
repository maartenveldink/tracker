import { test, expect } from '../fixtures/app';
import type { SchemaEditorPage } from '../pages/SchemaEditorPage';

// Two seeded default exercises used as superset members A and B.
const A = 'Barbell Bench Press';
const B = 'Barbell Row';

test.describe('Supersets — schema editor', () => {
  test('linking two exercises forms a superset with A/B badges', async ({ schemaEditor }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('Superset schema');
    await schemaEditor.addExercise(A);
    await schemaEditor.addExercise(B);

    await schemaEditor.linkWithPrevious(B);

    await expect(schemaEditor.supersetGroups).toHaveCount(1);
    await expect(schemaEditor.supersetBadge(A)).toHaveText('A');
    await expect(schemaEditor.supersetBadge(B)).toHaveText('B');
  });

  test('unlinking dissolves the superset', async ({ schemaEditor }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('Superset schema');
    await schemaEditor.addExercise(A);
    await schemaEditor.addExercise(B);
    await schemaEditor.linkWithPrevious(B);
    await expect(schemaEditor.supersetGroups).toHaveCount(1);

    await schemaEditor.unlink(B);

    await expect(schemaEditor.supersetGroups).toHaveCount(0);
    await expect(schemaEditor.supersetBadge(A)).toHaveCount(0);
  });
});

async function supersetSchema(schemaEditor: SchemaEditorPage, name: string): Promise<void> {
  await schemaEditor.gotoNew();
  await schemaEditor.setName(name);
  await schemaEditor.addExercise(A);
  await schemaEditor.addExercise(B);
  await schemaEditor.linkWithPrevious(B);
  await schemaEditor.save();
}

test.describe('Supersets — live workout (E2 zigzag)', () => {
  test('one zigzag A1 → B1 → A2 …: a round is logged A then B, rest only after B', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await supersetSchema(schemaEditor, 'Superset workout');
    await startWorkout.goto();
    await startWorkout.start('Superset workout');

    // A starts; "Superset" above the timer instead of a pill.
    await expect(workout.currentTitle).toContainText(A);
    await expect(workout.supersetLabel).toHaveText('Superset');
    await expect(workout.supersetBadge).toHaveCount(0);
    await expect(workout.supersetDots).toHaveCount(6);
    expect(
      await workout.supersetDots.evaluateAll(els => els.map(e => `${e.getAttribute('data-part')}${e.getAttribute('data-set')}`)),
    ).toEqual(['A1', 'B1', 'A2', 'B2', 'A3', 'B3']);
    await expect(workout.supersetDot(1, 'A')).toHaveAttribute('aria-pressed', 'true');
    await expect(workout.restRingIdle).toContainText('na B');

    // A done: B opens, no rest (mid-round), no Gedaan row for half a round.
    await workout.completeActiveSet(60, 10);
    await expect(workout.currentTitle).toContainText(B);
    await expect(workout.supersetDot(1, 'B')).toHaveAttribute('aria-pressed', 'true');
    await expect(workout.supersetDot(1, 'A')).toHaveAttribute('data-state', 'done');
    await expect(workout.restTimer).toHaveCount(0);
    await expect(workout.restRingIdle).toContainText('na B');
    await expect(workout.doneRows).toHaveCount(0);

    // B done: the round is over, rest starts, A of round 2 opens with A's values.
    await workout.completeActiveSet(50, 12);
    await expect(workout.restTimer).toBeVisible();
    await expect(workout.currentTitle).toContainText(A);
    await expect(workout.supersetDot(2, 'A')).toHaveAttribute('aria-pressed', 'true');
    await expect(workout.weightInput).toHaveValue('60');
    await expect(workout.repsInput).toHaveValue('10');
    await expect(workout.doneRows).toHaveCount(1);
    await expect(workout.doneRows.first()).toContainText('Set 1 · 60 × 10 · 50 × 12');
    await expect(workout.doneRows.first()).toContainText('nieuw');

    // A tap on a finished part opens it to adjust it ("Opslaan"), with B's name and values.
    await workout.supersetDot(1, 'B').click();
    await expect(workout.currentTitle).toContainText(B);
    await expect(workout.primaryButton).toHaveText('Opslaan');
    await expect(workout.weightInput).toHaveValue('50');
  });

  test('the plus dot adds a round to both exercises and opens its A part', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await supersetSchema(schemaEditor, 'Superset plus');
    await startWorkout.goto();
    await startWorkout.start('Superset plus');
    await expect(workout.supersetDots).toHaveCount(6);

    await workout.addSet();

    await expect(workout.supersetDots).toHaveCount(8);
    await expect(workout.supersetDot(4, 'A')).toHaveAttribute('aria-pressed', 'true');
    await expect(workout.supersetDot(4, 'B')).toHaveCount(1);
    await expect(workout.currentTitle).toContainText(A);
  });

  test('the Gedaan row compares the round with the same round last time', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await supersetSchema(schemaEditor, 'Superset verschil');
    await startWorkout.goto();
    await startWorkout.start('Superset verschil');
    await workout.completeActiveSet(60, 10);
    await workout.completeActiveSet(50, 12);
    await workout.finish();

    await startWorkout.goto();
    await startWorkout.start('Superset verschil');
    await workout.completeActiveSet(60, 11);
    await workout.completeActiveSet(50, 14);

    await expect(workout.doneRows.first()).toContainText('Set 1 · 60 × 11 · 50 × 14');
    await expect(workout.doneRows.first()).toContainText('↑ +3');
    // The row opens A of that round.
    await workout.doneRows.first().click();
    await expect(workout.currentTitle).toContainText(A);
    await expect(workout.supersetDot(1, 'A')).toHaveAttribute('aria-pressed', 'true');
  });
});
