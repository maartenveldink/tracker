import { groupSupersets } from './superset';
import type { WorkoutExercise } from '../../../db/index';

/** All sets are settled (completed or skipped); an exercise without sets is never "done". */
export function isExerciseDone(ex: WorkoutExercise): boolean {
  return ex.sets.length > 0 && ex.sets.every(s => s.completed || s.skipped);
}

/**
 * Where a newly added exercise goes in a running workout: directly after the
 * last finished exercise, so it becomes the next thing to train.
 *
 * - No exercise finished yet: right after the one in progress (first unfinished
 *   exercise with at least one settled set); when nothing is started, at the front.
 * - The insertion point never splits a superset: when the anchor exercise is part
 *   of a group, the new exercise goes after the whole group.
 *
 * Returns the index the new exercise should get (0..exercises.length).
 */
export function findInsertIndex(exercises: WorkoutExercise[]): number {
  let anchor = -1;
  for (let i = exercises.length - 1; i >= 0; i--) {
    if (isExerciseDone(exercises[i]!)) { anchor = i; break; }
  }
  if (anchor === -1) {
    anchor = exercises.findIndex(ex => ex.sets.some(s => s.completed || s.skipped));
  }
  if (anchor === -1) return 0;

  const info = groupSupersets(exercises)[anchor]!;
  const last = info.inSuperset ? info.members[info.members.length - 1]! : anchor;
  return last + 1;
}

/** Insert `item` at `index` and renumber `order` of every exercise (0..n-1). */
export function insertExerciseAt(
  exercises: WorkoutExercise[],
  item: WorkoutExercise,
  index: number,
): WorkoutExercise[] {
  const next = [...exercises];
  next.splice(index, 0, item);
  return next.map((ex, i) => ({ ...ex, order: i }));
}

/** Map an index-keyed position to its place after inserting a new item at `insertedAt`. */
export function shiftIndex(index: number, insertedAt: number): number {
  return index >= insertedAt ? index + 1 : index;
}
