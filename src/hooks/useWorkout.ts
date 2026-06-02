import { useLiveQuery } from 'dexie-react-hooks';
import { db, type WorkoutExercise, type WorkoutSet } from '../db/index';

export function useWorkout(id: number | undefined) {
  return useLiveQuery(
    () => (id ? db.workouts.get(id) : undefined),
    [id],
  );
}

export function useActiveWorkout() {
  return useLiveQuery(
    () => db.workouts.where('status').anyOf('active', 'paused').first(),
  );
}

/** Start a workout from a schema or ad-hoc (E3-01). */
export async function startWorkout(
  schemaId: number | null,
  schemaName: string | null,
  exercises: WorkoutExercise[],
): Promise<number> {
  const id = await db.workouts.add({
    schemaId,
    schemaName,
    exercises,
    status: 'active',
    startedAt: new Date(),
    pausedAt: null,
    totalPausedMs: 0,
    completedAt: null,
    notes: '',
  });
  return id as number;
}

/** Update a single set within a workout exercise (E3-02, E3-04). */
export async function updateWorkoutSet(
  workoutId: number,
  exerciseIndex: number,
  setIndex: number,
  update: Partial<WorkoutSet>,
): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout) return;

    const exercises = [...workout.exercises];
    const exercise = exercises[exerciseIndex];
    if (!exercise) return;

    const sets = [...exercise.sets];
    const existing = sets[setIndex];
    if (!existing) return;

    sets[setIndex] = { ...existing, ...update };
    exercises[exerciseIndex] = { ...exercise, sets };

    await db.workouts.update(workoutId, { exercises });
  });
}

/** Add an extra set to a workout exercise (E3-05). */
export async function addWorkoutSet(
  workoutId: number,
  exerciseIndex: number,
): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout) return;

    const exercises = [...workout.exercises];
    const exercise = exercises[exerciseIndex];
    if (!exercise) return;

    const lastSet = exercise.sets[exercise.sets.length - 1];
    const newSet: WorkoutSet = {
      exerciseId: exercise.exerciseId,
      setNumber: exercise.sets.length + 1,
      plannedReps: lastSet?.plannedReps ?? null,
      actualReps: null,
      weight: lastSet?.weight ?? null,
      completed: false,
      skipped: false,
    };

    exercises[exerciseIndex] = {
      ...exercise,
      sets: [...exercise.sets, newSet],
    };

    await db.workouts.update(workoutId, { exercises });
  });
}

/** Add an ad-hoc exercise to the current workout. */
export async function addWorkoutExercise(
  workoutId: number,
  exerciseId: number,
  sets: number = 3,
  reps: number = 10,
): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout) return;

    const newExercise: WorkoutExercise = {
      exerciseId,
      order: workout.exercises.length,
      sets: Array.from({ length: sets }, (_, i) => ({
        exerciseId,
        setNumber: i + 1,
        plannedReps: reps,
        actualReps: null,
        weight: null,
        completed: false,
        skipped: false,
      })),
      notes: '',
    };

    await db.workouts.update(workoutId, {
      exercises: [...workout.exercises, newExercise],
    });
  });
}

/** Update exercise-level notes (E3-09). */
export async function updateExerciseNotes(
  workoutId: number,
  exerciseIndex: number,
  notes: string,
): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout) return;

    const exercises = [...workout.exercises];
    const exercise = exercises[exerciseIndex];
    if (!exercise) return;

    exercises[exerciseIndex] = { ...exercise, notes };
    await db.workouts.update(workoutId, { exercises });
  });
}

/** Update workout-level notes (E3-09). */
export async function updateWorkoutNotes(
  workoutId: number,
  notes: string,
): Promise<void> {
  await db.workouts.update(workoutId, { notes });
}

/** Pause a workout (E3-07). */
export async function pauseWorkout(workoutId: number): Promise<void> {
  await db.workouts.update(workoutId, {
    status: 'paused',
    pausedAt: new Date(),
  });
}

/** Resume a paused workout (E3-07). */
export async function resumeWorkout(workoutId: number): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout || !workout.pausedAt) return;

    const pauseDuration = Date.now() - workout.pausedAt.getTime();
    await db.workouts.update(workoutId, {
      status: 'active',
      pausedAt: null,
      totalPausedMs: workout.totalPausedMs + pauseDuration,
    });
  });
}

/** Complete a workout (E3-06, E3-08). */
export async function completeWorkout(workoutId: number): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout) return;

    let totalPausedMs = workout.totalPausedMs;
    if (workout.pausedAt) {
      totalPausedMs += Date.now() - workout.pausedAt.getTime();
    }

    await db.workouts.update(workoutId, {
      status: 'completed',
      completedAt: new Date(),
      pausedAt: null,
      totalPausedMs,
    });
  });
}
