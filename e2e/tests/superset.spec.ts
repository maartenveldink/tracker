import { test, expect } from '../fixtures/app';

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

test.describe('Supersets — live workout', () => {
  test('alternates between members and rests only after the round', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    // Arrange: a schema whose two exercises are a superset.
    await schemaEditor.gotoNew();
    await schemaEditor.setName('Superset workout');
    await schemaEditor.addExercise(A);
    await schemaEditor.addExercise(B);
    await schemaEditor.linkWithPrevious(B);
    await schemaEditor.save();

    // Act: start the workout.
    await startWorkout.goto();
    await startWorkout.start('Superset workout');

    // The superset is rendered as one group; A starts expanded.
    await expect(workout.supersetGroups).toHaveCount(1);
    expect(await workout.expandedExerciseName()).toContain(A);

    // Completing A's set hands off to B with no rest (mid-round).
    await workout.completeActiveSet(60, 10);
    await expect(workout.expandedCard.locator('h3').first()).toContainText(B);
    await expect(workout.restTimer).toHaveCount(0);

    // Completing B's set ends the round: rest starts, focus returns to A.
    await workout.completeActiveSet(50, 10);
    await expect(workout.restTimer).toBeVisible();
    await expect(workout.expandedCard.locator('h3').first()).toContainText(A);
  });
});
