import type { Workout } from '../../../db/index';
import { calculate1RM, type OneRMFormula } from '../hooks/useProgress';
import { compareSessions, weightedLines, type SessionComparison } from './celebration';
import { workoutVolume } from './metrics';
import { isCompletedSet, isWeightedSet } from './sets';

/**
 * Derived values for the workout summary ("wat heb ik vandaag bereikt, en hoe
 * ben ik vooruitgegaan"). Everything is compared with *earlier* workouts only,
 * so opening an old summary from the history shows what was true back then.
 *
 * - "Beter dan vorige keer" = the same rule as the live "Oefening klaar"
 *   moment: average estimated 1RM over the weighted sets beats the most recent
 *   earlier session of that exercise that had weighted sets (`compareSessions`).
 * - Personal record = best estimated 1RM of a set today beats the best of all
 *   earlier sessions (and there was an earlier one: a first session is no PR).
 */

export interface ExerciseResult {
  exerciseId: string;
  /** Position in `workout.exercises`. */
  index: number;
  /** Performed sets (bodyweight sets count). */
  completedSets: number;
  /** Comparison with the previous session of this exercise; null when there is none. */
  comparison: SessionComparison | null;
  improved: boolean;
  isPR: boolean;
  /** Best estimated 1RM of a set today; 0 without weighted sets. */
  best1RM: number;
  /** Best estimated 1RM over all earlier sessions; null when never done with weight. */
  previousBest1RM: number | null;
}

export interface WorkoutSummaryData {
  exercises: ExerciseResult[];
  totalSets: number;
  volume: number;
  /** Total volume minus the previous session of the same schema (day); null without one. */
  volumeDelta: number | null;
  /** Exercises that had a previous session to compare with. */
  comparableCount: number;
  /** Exercises better than last time (PRs included when their average went up too). */
  improvedCount: number;
  prCount: number;
}

const byNewest = (a: Workout, b: Workout) => b.startedAt.getTime() - a.startedAt.getTime();

/** Completed workouts started before `workout`, newest first. */
function earlierWorkouts(workout: Workout, history: Workout[]): Workout[] {
  const start = workout.startedAt.getTime();
  return history
    .filter(w => w.id !== workout.id && w.startedAt.getTime() < start)
    .sort(byNewest);
}

/** Most recent earlier workout of the same schema (and day, for multi-day schemas). */
export function previousSchemaSession(workout: Workout, history: Workout[]): Workout | null {
  if (!workout.schemaId) return null;
  return (
    earlierWorkouts(workout, history).find(
      w => w.schemaId === workout.schemaId && (w.schemaDayId ?? null) === (workout.schemaDayId ?? null),
    ) ?? null
  );
}

function best1RMOf(sets: Workout['exercises'][number]['sets'], formula: OneRMFormula): number {
  let best = 0;
  for (const s of sets) {
    if (!isWeightedSet(s)) continue;
    best = Math.max(best, calculate1RM(s.weight!, s.actualReps!, formula));
  }
  return best;
}

export function summarizeWorkout(
  workout: Workout,
  history: Workout[],
  formula: OneRMFormula,
): WorkoutSummaryData {
  const earlier = earlierWorkouts(workout, history);

  const exercises: ExerciseResult[] = workout.exercises.map((we, index) => {
    const today = weightedLines(we.sets);
    const best1RM = best1RMOf(we.sets, formula);

    let previousLines = null;
    let previousBest = 0;
    for (const w of earlier) {
      for (const e of w.exercises) {
        if (e.exerciseId !== we.exerciseId) continue;
        const lines = weightedLines(e.sets);
        if (previousLines === null && lines.length > 0) previousLines = lines;
        previousBest = Math.max(previousBest, best1RMOf(e.sets, formula));
      }
    }

    const comparison = compareSessions(today, previousLines, formula);
    return {
      exerciseId: we.exerciseId,
      index,
      completedSets: we.sets.filter(isCompletedSet).length,
      comparison,
      improved: comparison?.improved ?? false,
      isPR: previousBest > 0 && best1RM > previousBest,
      best1RM,
      previousBest1RM: previousBest > 0 ? previousBest : null,
    };
  });

  const volume = workoutVolume(workout);
  const prevSchema = previousSchemaSession(workout, history);
  return {
    exercises,
    totalSets: exercises.reduce((n, e) => n + e.completedSets, 0),
    volume,
    volumeDelta: prevSchema ? Math.round(volume - workoutVolume(prevSchema)) : null,
    comparableCount: exercises.filter(e => e.comparison !== null).length,
    improvedCount: exercises.filter(e => e.improved).length,
    prCount: exercises.filter(e => e.isPR).length,
  };
}

/**
 * Fireworks rule: only when there is really something to celebrate — at least
 * one exercise better than last time or a new personal record. Just finishing
 * (or a bigger volume through extra sets) is acknowledged warmly, not with fireworks.
 */
export function hasSomethingToCelebrate(s: WorkoutSummaryData): boolean {
  return s.improvedCount > 0 || s.prCount > 0;
}

export interface SummaryHeadline {
  celebrate: boolean;
  title: string;
  subline: string;
}

/** Hero text: what was achieved, without claiming progress that isn't there. */
export function summaryHeadline(s: WorkoutSummaryData): SummaryHeadline {
  if (hasSomethingToCelebrate(s)) {
    const parts: string[] = [];
    if (s.prCount > 0) parts.push(`${s.prCount} ${s.prCount === 1 ? 'persoonlijk record' : 'persoonlijke records'}`);
    if (s.improvedCount > 0) {
      parts.push(
        `${s.improvedCount} van ${s.comparableCount} ${s.comparableCount === 1 ? 'oefening' : 'oefeningen'} beter dan vorige keer`,
      );
    }
    return { celebrate: true, title: 'Je bent vooruitgegaan', subline: parts.join(' · ') };
  }
  if (s.comparableCount === 0) {
    return {
      celebrate: false,
      title: 'Training voltooid',
      subline: 'Dit is je startpunt: volgende keer zie je hier hoe je vooruitgaat.',
    };
  }
  return {
    celebrate: false,
    title: 'Training voltooid',
    subline: 'Goed gedaan dat je er stond. Elke training telt mee.',
  };
}

/** How long after finishing the summary still counts as "just finished". */
export const ARRIVAL_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Play the arrival effects only right after finishing a workout: the live
 * workout navigates here with a `justFinished` flag (opening from the history
 * or calendar has none), and the flag must be fresh. The page clears the flag
 * after use, and the age check covers a browser that restores old history state.
 */
export function shouldPlayArrivalCelebration(input: {
  justFinished: boolean;
  completedAt: Date | null;
  now: Date;
  maxAgeMs?: number;
}): boolean {
  const { justFinished, completedAt, now, maxAgeMs = ARRIVAL_MAX_AGE_MS } = input;
  if (!justFinished || !completedAt) return false;
  const age = now.getTime() - completedAt.getTime();
  return age >= -5000 && age <= maxAgeMs;
}
