import type { AppSettings, Exercise, SchemaExercise, Workout, WorkoutSet } from '../../../db/index';
import { getMuscleGroupById, MUSCLE_GROUPS } from '../db/muscles';
import { estimateExercisesSeconds } from './estimateSchemaTime';

/**
 * Suggests a free workout that prioritises muscle groups the user hasn't
 * trained much lately, sized to fit a target duration. Pure and deterministic
 * given its inputs (a `seed` varies the picks for "regenerate").
 */

/** A muscle group counts as "sufficiently trained" at/above this many sets in the window. */
export const WEEKLY_SET_TARGET = 10;
/** Recency window for the set count, in days. */
export const WINDOW_DAYS = 7;

/** Default prescription for a suggested exercise. */
const DEFAULT_SETS = 3;
const DEFAULT_REPS_MIN = 8;
const DEFAULT_REPS_MAX = 12;
/** Never suggest more than this many exercises regardless of target duration. */
const MAX_EXERCISES = 8;

type MuscleLevel = 'global' | 'detailed';
type EstimateSettings = Pick<AppSettings, 'restTimerSeconds' | 'restDefaults' | 'exerciseTransitionSeconds'>;

function isCompletedSet(s: WorkoutSet): boolean {
  return s.completed && s.weight !== null && s.weight > 0 && s.actualReps !== null && s.actualReps > 0;
}

// Category name → global muscle id, to collapse detailed ids to their global group.
const CATEGORY_TO_GLOBAL = new Map<string, string>(
  MUSCLE_GROUPS.filter(m => m.level === 'global').map(m => [m.category, m.id]),
);

/** Maps a tagged muscle id onto the target grouping for the given detail level. */
function toTargetId(muscleId: string, level: MuscleLevel): string {
  const g = getMuscleGroupById(muscleId);
  if (!g) return muscleId;
  if (level === 'detailed') return muscleId;
  if (g.level === 'global') return g.id;
  return CATEGORY_TO_GLOBAL.get(g.category) ?? muscleId;
}

// Small seeded PRNG (mulberry32) so "regenerate" produces stable variety.
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface GroupStaleness {
  groupId: string;
  setsInWindow: number;
  daysSinceLast: number; // large when never trained
  score: number;         // higher = staler
}

/**
 * Per target muscle group: how many primary-muscle sets were logged in the
 * recent window, and how long ago it was last trained. Staler groups score
 * higher.
 */
export function muscleStaleness(
  completedWorkouts: Workout[],
  exerciseById: Map<number, Exercise>,
  level: MuscleLevel,
  now: Date = new Date(),
): GroupStaleness[] {
  const windowStart = now.getTime() - WINDOW_DAYS * 86_400_000;
  const setsInWindow = new Map<string, number>();
  const lastTrained = new Map<string, number>();
  const seen = new Set<string>();

  // Seed the universe of groups from the exercise library, so muscle groups
  // never trained yet (no history) are still candidates — this drives the cold
  // start / full-body fallback.
  for (const ex of exerciseById.values()) {
    for (const m of ex.primaryMuscles) seen.add(toTargetId(m, level));
  }

  for (const w of completedWorkouts) {
    const t = w.startedAt.getTime();
    for (const we of w.exercises) {
      const ex = exerciseById.get(we.exerciseId);
      if (!ex) continue;
      const completed = we.sets.filter(isCompletedSet).length;
      if (completed === 0) continue;
      const groups = new Set(ex.primaryMuscles.map(m => toTargetId(m, level)));
      for (const g of groups) {
        seen.add(g);
        if (t >= windowStart) setsInWindow.set(g, (setsInWindow.get(g) ?? 0) + completed);
        const prev = lastTrained.get(g);
        if (prev === undefined || t > prev) lastTrained.set(g, t);
      }
    }
  }

  return Array.from(seen).map(groupId => {
    const sets = setsInWindow.get(groupId) ?? 0;
    const last = lastTrained.get(groupId);
    const daysSinceLast = last === undefined ? 999 : Math.floor((now.getTime() - last) / 86_400_000);
    return { groupId, setsInWindow: sets, daysSinceLast, score: Math.max(0, WEEKLY_SET_TARGET - sets) + daysSinceLast };
  });
}

interface SuggestionInput {
  completedWorkouts: Workout[];
  exercises: Exercise[];
  level: MuscleLevel;
  targetSeconds: number;
  settings: EstimateSettings;
  /** Exercise ids that have logged history — preferred so weight prefill works. */
  hasHistory: Set<number>;
  seed?: number;
  now?: Date;
}

/** Exercises whose primary muscles map onto `groupId` at the given level. */
function exercisesForGroup(exercises: Exercise[], groupId: string, level: MuscleLevel): Exercise[] {
  return exercises.filter(ex => ex.primaryMuscles.some(m => toTargetId(m, level) === groupId));
}

function toSchemaExercise(exerciseId: number, order: number): SchemaExercise {
  return {
    exerciseId,
    sets: DEFAULT_SETS,
    repsPerSet: DEFAULT_REPS_MIN,
    repsMax: DEFAULT_REPS_MAX,
    order,
  };
}

/**
 * Builds a suggested exercise list, growing it until the estimated duration
 * meets `targetSeconds` (bounded by {@link MAX_EXERCISES}). Cold start (no
 * history at all) falls back to a spread across whatever groups exist.
 */
export function suggestWorkout(input: SuggestionInput): SchemaExercise[] {
  const { completedWorkouts, exercises, level, targetSeconds, settings, hasHistory, seed = 1, now } = input;
  const exerciseById = new Map(exercises.map(e => [e.id!, e]));
  const rng = makeRng(seed);

  const stale = muscleStaleness(completedWorkouts, exerciseById, level, now)
    .sort((a, b) => b.score - a.score || rng() - 0.5);

  // Candidate groups: understimulated groups first, then all groups as fallback
  // (cold start / everything already trained enough).
  const candidateGroups = stale.filter(g => g.setsInWindow < WEEKLY_SET_TARGET).map(g => g.groupId);
  const fallbackGroups = stale.map(g => g.groupId);
  const orderedGroups = candidateGroups.length > 0 ? candidateGroups : fallbackGroups;

  const chosen: number[] = [];
  const chosenSet = new Set<number>();

  function pickForGroup(groupId: string): number | undefined {
    const pool = exercisesForGroup(exercises, groupId, level).filter(e => !chosenSet.has(e.id!));
    if (pool.length === 0) return undefined;
    // Prefer exercises with history so weight prefill works; shuffle within tier.
    const withHist = pool.filter(e => hasHistory.has(e.id!));
    const tier = withHist.length > 0 ? withHist : pool;
    const pick = tier[Math.floor(rng() * tier.length)]!;
    return pick.id!;
  }

  function estimate(ids: number[]): number {
    return estimateExercisesSeconds(ids.map(toSchemaExercise), exerciseById, settings);
  }

  // Pass 1: one exercise per stale group, in staleness order, until target met.
  for (const groupId of orderedGroups) {
    if (chosen.length >= MAX_EXERCISES) break;
    if (chosen.length > 0 && estimate(chosen) >= targetSeconds) break;
    const id = pickForGroup(groupId);
    if (id === undefined) continue;
    chosen.push(id);
    chosenSet.add(id);
  }

  // Pass 2: still short? add extra exercises for the stalest groups.
  let guard = 0;
  while (chosen.length < MAX_EXERCISES && estimate(chosen) < targetSeconds && guard < MAX_EXERCISES * 2) {
    guard++;
    let added = false;
    for (const groupId of orderedGroups) {
      if (chosen.length >= MAX_EXERCISES) break;
      if (estimate(chosen) >= targetSeconds) break;
      const id = pickForGroup(groupId);
      if (id === undefined) continue;
      chosen.push(id);
      chosenSet.add(id);
      added = true;
    }
    if (!added) break;
  }

  return chosen.map((id, order) => toSchemaExercise(id, order));
}

/**
 * Exercises similar to `exercise`, for the swipe-to-swap action. Tiers, best
 * first: same primary group + movement type + laterality; then relax
 * laterality; then relax movement type. Excludes the exercise itself and any
 * ids in `exclude`.
 */
export function findSimilarExercises(
  exercise: Exercise,
  all: Exercise[],
  exclude: Set<number> = new Set(),
): Exercise[] {
  const primary = new Set(exercise.primaryMuscles);
  const sharesPrimary = (e: Exercise) => e.primaryMuscles.some(m => primary.has(m));

  const pool = all.filter(
    e => e.id !== exercise.id && !exclude.has(e.id!) && sharesPrimary(e),
  );

  const seen = new Set<number>();
  const tiers: ((e: Exercise) => boolean)[] = [
    e => e.movementType === exercise.movementType && e.laterality === exercise.laterality,
    e => e.movementType === exercise.movementType,
    () => true,
  ];

  const result: Exercise[] = [];
  for (const match of tiers) {
    for (const e of pool) {
      if (seen.has(e.id!)) continue;
      if (match(e)) {
        seen.add(e.id!);
        result.push(e);
      }
    }
  }
  return result;
}
