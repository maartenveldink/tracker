import type { AppSettings, Exercise, SchemaExercise } from '../../../db/index';
import { resolveRestSeconds } from './restTime';

/**
 * Rough working time per rep (seconds): the concentric/eccentric movement plus a
 * little slack per set. Used to estimate how long the actual lifting takes.
 */
export const SECONDS_PER_REP = 3;

type EstimateSettings = Pick<
  AppSettings,
  'restTimerSeconds' | 'restDefaults' | 'exerciseTransitionSeconds'
>;

/**
 * Estimated total duration (seconds) of a list of schema exercises.
 *
 * Model, per exercise:
 * - work = sets × reps × {@link SECONDS_PER_REP}
 * - rest = (sets − 1) × effective rest between sets
 * Unilateral exercises count double sets (each set is trained per side), so both
 * work and rest scale accordingly. Between exercises a configurable transition
 * time (tidy-up + setup of the next station) is added.
 *
 * Supersets are approximated: rest is counted per exercise rather than once per
 * round, which slightly overestimates — acceptable for a rough guide.
 */
export function estimateExercisesSeconds(
  exercises: SchemaExercise[],
  exerciseMap: Map<number, Exercise>,
  settings: EstimateSettings,
): number {
  let total = 0;
  for (const se of exercises) {
    const exercise = exerciseMap.get(se.exerciseId);
    const perSide = exercise?.laterality === 'unilateral' ? 2 : 1;
    const effectiveSets = se.sets * perSide;
    const reps = se.repsMax ?? se.repsPerSet;
    const work = effectiveSets * reps * SECONDS_PER_REP;
    const rest = resolveRestSeconds({ schemaRestSeconds: se.restSeconds, exercise, settings });
    const restTotal = Math.max(0, effectiveSets - 1) * rest;
    total += work + restTotal;
  }
  if (exercises.length > 1) {
    total += (exercises.length - 1) * settings.exerciseTransitionSeconds;
  }
  return total;
}

/** Formats a duration in seconds as a short label, e.g. "~52 min" or "~1 u 5 min". */
export function formatEstimatedTime(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '~1 min';
  if (mins < 60) return `~${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `~${h} u` : `~${h} u ${m} min`;
}
