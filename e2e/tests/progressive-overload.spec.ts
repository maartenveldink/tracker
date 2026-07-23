import { test, expect } from '../fixtures/app';

// Barbell Bench Press defaults to "plates" equipment → a 1.25 kg increment.
const A = 'Barbell Bench Press';

test.describe('Progressive overload', () => {
  test('bumps the suggested weight after hitting the target reps on every set', async ({
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Overload'); // default 3×10
    await schemaEditor.addExercise(A);
    await schemaEditor.save();

    // Session 1: 60 kg, all three sets at the target of 10 reps.
    await startWorkout.goto();
    await startWorkout.start('E2E Overload');
    await workout.completeActiveSet(60, 10);
    await workout.logActiveReps(10); // set 2 (weight carried over)
    await workout.logActiveReps(10); // set 3
    await workout.finish();

    // Session 2: the app suggests one increment heavier (60 + 1.25 = 61.25).
    await startWorkout.goto();
    await startWorkout.start('E2E Overload');
    await expect(workout.setWeightInput(0)).toHaveAttribute('placeholder', '61.25');
  });
});
