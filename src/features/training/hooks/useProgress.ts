import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Workout, type WorkoutSet } from '../../../db/index';

// --- 1RM formulas (E4-02, E8-01) ---

export type OneRMFormula = 'epley' | 'brzycki' | 'lombardi';

export function calculate1RM(weight: number, reps: number, formula: OneRMFormula): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;

  switch (formula) {
    case 'epley':
      return weight * (1 + reps / 30);
    case 'brzycki':
      if (reps >= 37) {
        // Brzycki is undefined at >=37 reps; fall back to Epley for a stable estimate.
        return calculate1RM(weight, reps, 'epley');
      }
      return weight * (36 / (37 - reps));
    case 'lombardi':
      return weight * Math.pow(reps, 0.1);
  }
}

// --- Types ---

export interface SessionSet {
  setNumber: number;
  reps: number;
  weight: number;
  estimated1RM: number;
  volume: number;
}

export interface ExerciseSession {
  workoutId: number;
  date: Date;
  schemaName: string | null;
  sets: SessionSet[];
  bestSet: SessionSet;
  best1RM: number;
}

export type PeriodFilter = '4w' | '3m' | 'all';

// --- Hook ---

export function useCompletedWorkouts() {
  return useLiveQuery(
    () => db.workouts.where('status').equals('completed').sortBy('startedAt'),
  ) ?? [];
}

/** Pure: builds the session history for one exercise from a list of workouts. */
export function computeExerciseSessions(
  workouts: Workout[],
  exerciseId: number | undefined,
  formula: OneRMFormula = 'epley',
): ExerciseSession[] {
  if (!exerciseId || !workouts.length) return [];

  return workouts
    .filter(w => w.exercises.some(e => e.exerciseId === exerciseId))
    .map(w => workoutToSession(w, exerciseId, formula))
    .filter((s): s is ExerciseSession => s !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function useProgress(
  exerciseId: number | undefined,
  formula: OneRMFormula = 'epley',
) {
  const workouts = useCompletedWorkouts();

  const sessions = useMemo<ExerciseSession[]>(
    () => computeExerciseSessions(workouts, exerciseId, formula),
    [workouts, exerciseId, formula],
  );

  return sessions;
}

function workoutToSession(
  workout: Workout,
  exerciseId: number,
  formula: OneRMFormula,
): ExerciseSession | null {
  const workoutExercise = workout.exercises.find(e => e.exerciseId === exerciseId);
  if (!workoutExercise) return null;

  const completedSets = workoutExercise.sets.filter(isCompletedSet);
  if (completedSets.length === 0) return null;

  const sessionSets: SessionSet[] = completedSets.map(s => {
    const reps = s.actualReps!;
    const weight = s.weight!;
    return {
      setNumber: s.setNumber,
      reps,
      weight,
      estimated1RM: calculate1RM(weight, reps, formula),
      volume: weight * reps,
    };
  });

  const bestSet = sessionSets.reduce((best, current) =>
    current.estimated1RM > best.estimated1RM ? current : best,
  );

  return {
    workoutId: workout.id!,
    date: workout.startedAt,
    schemaName: workout.schemaName,
    sets: sessionSets,
    bestSet,
    best1RM: bestSet.estimated1RM,
  };
}

function isCompletedSet(s: WorkoutSet): boolean {
  return s.completed && s.actualReps !== null && s.actualReps > 0 && s.weight !== null && s.weight > 0;
}

// --- Exercises sorted by last session date ---

export interface ExerciseWithLastSession {
  id: number;
  lastSessionAt: Date;
}

export function useExercisesWithLastSession(): ExerciseWithLastSession[] {
  const workouts = useCompletedWorkouts();

  return useMemo(() => {
    // Build a map: exerciseId → most recent startedAt
    const lastSeen = new Map<number, Date>();

    for (const workout of workouts) {
      for (const ex of workout.exercises) {
        const hasCompletedSet = ex.sets.some(isCompletedSet);
        if (!hasCompletedSet) continue;

        const prev = lastSeen.get(ex.exerciseId);
        if (!prev || workout.startedAt > prev) {
          lastSeen.set(ex.exerciseId, workout.startedAt);
        }
      }
    }

    return Array.from(lastSeen.entries())
      .map(([id, lastSessionAt]): ExerciseWithLastSession => ({ id, lastSessionAt }))
      .sort((a, b) => b.lastSessionAt.getTime() - a.lastSessionAt.getTime());
  }, [workouts]);
}

/** Delete an entire workout (E4-06). */
export async function deleteWorkout(id: number): Promise<void> {
  await db.workouts.delete(id);
}

/** Filter sessions by period. */
export function filterByPeriod(sessions: ExerciseSession[], period: PeriodFilter): ExerciseSession[] {
  if (period === 'all') return sessions;

  const now = new Date();
  const cutoff = new Date(now);
  if (period === '4w') {
    cutoff.setDate(cutoff.getDate() - 28);
  } else {
    cutoff.setMonth(cutoff.getMonth() - 3);
  }

  return sessions.filter(s => s.date >= cutoff);
}
