import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId, freshSyncMeta, touchSyncMeta, type Workout, type WorkoutExercise, type WorkoutSet } from '../../../db/index';

export function useWorkout(id: string | undefined) {
  return useLiveQuery(
    async () => {
      if (!id) return undefined;
      const w = await db.workouts.get(id);
      return w && !w.deleted ? w : undefined;
    },
    [id],
  );
}

export interface ActiveWorkoutState {
  isLoading: boolean;
  workout: Workout | undefined;
}

export function useActiveWorkout() {
  return useLiveQuery<ActiveWorkoutState>(
    async () => {
      const workout = await db.workouts
        .where('status').anyOf('active', 'paused')
        .filter(w => !w.deleted)
        .first();
      return { isLoading: false, workout };
    },
    [],
  );
}

/** Start a workout from a schema or ad-hoc (E3-01, E2-11). */
export async function startWorkout(
  schemaId: string | null,
  schemaName: string | null,
  exercises: WorkoutExercise[],
  schemaDayId: string | null = null,
  schemaDayName: string | null = null,
): Promise<string> {
  const id = newId();
  await db.workouts.add({
    id,
    schemaId,
    schemaName,
    exercises,
    schemaDayId,
    schemaDayName,
    status: 'active',
    startedAt: new Date(),
    pausedAt: null,
    totalPausedMs: 0,
    completedAt: null,
    notes: '',
    ...freshSyncMeta(),
  });
  return id;
}

/** Update a single set within a workout exercise (E3-02, E3-04). */
export async function updateWorkoutSet(
  workoutId: string,
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

    await db.workouts.update(workoutId, { exercises, ...touchSyncMeta() });
  });
}

/** Add an extra set to a workout exercise (E3-05). */
export async function addWorkoutSet(
  workoutId: string,
  exerciseIndex: number,
): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout) return;

    const exercises = [...workout.exercises];
    const exercise = exercises[exerciseIndex];
    if (!exercise) return;

    const lastSet = exercise.sets[exercise.sets.length - 1];
    // Unilateral exercises log per side, so a set is added as a left/right pair.
    const isUnilateral = lastSet?.side !== undefined;
    const sides: (WorkoutSet['side'])[] = isUnilateral ? ['left', 'right'] : [undefined];

    const newSets: WorkoutSet[] = sides.map((side, i) => ({
      exerciseId: exercise.exerciseId,
      setNumber: exercise.sets.length + 1 + i,
      plannedReps: lastSet?.plannedReps ?? null,
      ...(lastSet?.plannedRepsMax != null ? { plannedRepsMax: lastSet.plannedRepsMax } : {}),
      ...(lastSet?.plannedWeight != null ? { plannedWeight: lastSet.plannedWeight } : {}),
      ...(side ? { side } : {}),
      actualReps: null,
      weight: lastSet?.weight ?? null,
      completed: false,
      skipped: false,
    }));

    exercises[exerciseIndex] = {
      ...exercise,
      sets: [...exercise.sets, ...newSets],
    };

    await db.workouts.update(workoutId, { exercises, ...touchSyncMeta() });
  });
}

/** Remove a set from a workout exercise, renumbering the remaining sets. */
export async function removeWorkoutSet(
  workoutId: string,
  exerciseIndex: number,
  setIndex: number,
): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout) return;

    const exercises = [...workout.exercises];
    const exercise = exercises[exerciseIndex];
    if (!exercise) return;

    const sets = exercise.sets
      .filter((_, i) => i !== setIndex)
      .map((set, i) => ({ ...set, setNumber: i + 1 }));

    exercises[exerciseIndex] = { ...exercise, sets };
    await db.workouts.update(workoutId, { exercises, ...touchSyncMeta() });
  });
}

/** Remove an entire exercise from the workout, reindexing the remaining order. */
export async function removeWorkoutExercise(
  workoutId: string,
  exerciseIndex: number,
): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout) return;

    const exercises = workout.exercises
      .filter((_, i) => i !== exerciseIndex)
      .map((ex, i) => ({ ...ex, order: i }));

    await db.workouts.update(workoutId, { exercises, ...touchSyncMeta() });
  });
}

/** Add an ad-hoc exercise to the current workout. */
export async function addWorkoutExercise(
  workoutId: string,
  exerciseId: string,
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
      ...touchSyncMeta(),
    });
  });
}

/** Update exercise-level notes (E3-09). */
export async function updateExerciseNotes(
  workoutId: string,
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
    await db.workouts.update(workoutId, { exercises, ...touchSyncMeta() });
  });
}

/** Update workout-level notes (E3-09). */
export async function updateWorkoutNotes(
  workoutId: string,
  notes: string,
): Promise<void> {
  await db.workouts.update(workoutId, { notes, ...touchSyncMeta() });
}

/** Update an entire workout's exercises and notes (E4-08). */
export async function updateWorkout(
  workoutId: string,
  exercises: WorkoutExercise[],
  notes: string,
): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    await db.workouts.update(workoutId, { exercises, notes, ...touchSyncMeta() });
  });
}

/** Pause a workout (E3-07). */
export async function pauseWorkout(workoutId: string): Promise<void> {
  await db.workouts.update(workoutId, {
    status: 'paused',
    pausedAt: new Date(),
    ...touchSyncMeta(),
  });
}

/** Resume a paused workout (E3-07). */
export async function resumeWorkout(workoutId: string): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout || !workout.pausedAt) return;

    const pauseDuration = Date.now() - workout.pausedAt.getTime();
    await db.workouts.update(workoutId, {
      status: 'active',
      pausedAt: null,
      totalPausedMs: workout.totalPausedMs + pauseDuration,
      ...touchSyncMeta(),
    });
  });
}

/** Complete a workout (E3-06, E3-08). */
export async function completeWorkout(workoutId: string): Promise<void> {
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
      ...touchSyncMeta(),
    });
  });
}
