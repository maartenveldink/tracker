import type { WorkoutSet } from '../../../db/index';

/**
 * Shared set predicates. A completed set with reps > 0 counts as a performed
 * set even without external weight (pull-ups, push-ups, planks: weight null/0).
 * Weight-based maths (volume, 1RM, PRs) only applies to weighted sets.
 */

/** A set that was actually performed: completed with reps > 0. Bodyweight sets count. */
export function isCompletedSet(s: WorkoutSet): boolean {
  return s.completed && s.actualReps !== null && s.actualReps > 0;
}

/** A performed set that also carries external weight (> 0): eligible for 1RM / PRs. */
export function isWeightedSet(s: WorkoutSet): boolean {
  return isCompletedSet(s) && s.weight !== null && s.weight > 0;
}

/** Volume in kg of one set (weight × reps); 0 for sets that aren't performed or have no weight. */
export function setVolume(s: WorkoutSet): number {
  return isWeightedSet(s) ? s.weight! * s.actualReps! : 0;
}

/**
 * Removes the set at `index` and renumbers the rest. Unilateral exercises log
 * each set as an adjacent left+right pair, so removing one side removes its
 * partner too; bilateral sets (no `side`) are removed alone.
 */
export function removeSetAt(sets: WorkoutSet[], index: number): WorkoutSet[] {
  const target = sets[index];
  if (!target) return sets;
  const drop = new Set<number>([index]);
  if (target.side === 'left' && sets[index + 1]?.side === 'right') drop.add(index + 1);
  if (target.side === 'right' && sets[index - 1]?.side === 'left') drop.add(index - 1);
  return sets
    .filter((_, i) => !drop.has(i))
    .map((set, i) => ({ ...set, setNumber: i + 1 }));
}
