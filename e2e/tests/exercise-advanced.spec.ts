import { test, expect } from '../fixtures/app';

const A = 'Barbell Bench Press';

test.describe('Exercises — advanced', () => {
  test('a per-exercise weight-step override drives the progressive-overload bump', async ({
    exercises,
    exerciseForm,
    schemaEditor,
    startWorkout,
    workout,
  }) => {
    // Override Bench Press to a 2.5 kg step (default for plates is 1.25 kg).
    await exercises.goto();
    await exercises.open(A);
    await exerciseForm.setWeightStep('2,5 kg');
    await exerciseForm.save();

    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Step Override');
    await schemaEditor.addExercise(A);
    await schemaEditor.save();

    // Session 1: 60 kg, all sets at the target.
    await startWorkout.goto();
    await startWorkout.start('E2E Step Override');
    await workout.completeActiveSet(60, 10);
    await workout.logActiveReps(10);
    await workout.logActiveReps(10);
    await workout.finish();

    // Session 2: bump uses the 2.5 kg override → 62.5 (not the 1.25 default).
    await startWorkout.goto();
    await startWorkout.start('E2E Step Override');
    await expect(workout.setWeightInput(0)).toHaveAttribute('placeholder', '62.5');
  });
});
