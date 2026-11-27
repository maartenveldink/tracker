import type { WorkoutExercise, WorkoutSet } from '../../../db/index';
import { groupSupersets } from './superset';
import { shiftIndex } from './insertPosition';
import { pairPartnerIndex, removeSetAt } from './sets';

/**
 * Pure state machine behind the live-training screen (DESIGN §6,
 * `Training.dc.html`). The status of an exercise is *derived* from the stored
 * sets, so there is nothing extra to persist and a reload restores everything.
 * Only the "current exercise" pointer is UI state.
 */

export type ExerciseStatus = 'todo' | 'done' | 'skipped';

/** Maximum number of planned sets per exercise (a unilateral left+right pair counts as one). */
export const MAX_SETS = 8;

/**
 * `todo` while any set is unsettled (or there are no sets), `done` when all sets
 * are settled and at least one was performed, `skipped` when all are settled and
 * none was performed.
 */
export function exerciseStatus(ex: WorkoutExercise): ExerciseStatus {
  if (ex.sets.length === 0) return 'todo';
  if (ex.sets.some(s => !s.completed && !s.skipped)) return 'todo';
  return ex.sets.some(s => s.completed) ? 'done' : 'skipped';
}

export function exerciseStatuses(exercises: WorkoutExercise[]): ExerciseStatus[] {
  return exercises.map(exerciseStatus);
}

/**
 * The "zoekregel": the first `todo` after `from`, else the first `todo` before
 * it, else -1 (klaar-toestand). `from` itself is never returned; pass -1 to get
 * the first `todo` overall.
 */
export function findNextTodo(statuses: ExerciseStatus[], from: number): number {
  for (let i = from + 1; i < statuses.length; i++) if (statuses[i] === 'todo') return i;
  for (let i = 0; i < from && i < statuses.length; i++) if (statuses[i] === 'todo') return i;
  return -1;
}

export type PrimaryAction = 'set' | 'save' | 'next' | 'last' | 'finish';

/** What the big bottom button does. */
export function primaryAction(input: {
  /** Klaar-toestand: no current exercise. */
  finished: boolean;
  /** Every set of the current exercise is settled. */
  exerciseComplete: boolean;
  /** A `todo` exercise exists besides the current one. */
  hasNext: boolean;
  /**
   * The set shown in the set card (B1 `sel`): `logged` = an already completed
   * set is being adjusted ("Opslaan"), `open` = a set still to log, absent = none.
   */
  opened?: 'logged' | 'open';
}): PrimaryAction {
  if (input.finished) return 'finish';
  if (input.opened === 'logged') return 'save';
  if (input.opened === 'open' || !input.exerciseComplete) return 'set';
  return input.hasNext ? 'next' : 'last';
}

export function primaryLabel(action: PrimaryAction): string {
  switch (action) {
    case 'set': return 'Set klaar';
    case 'save': return 'Opslaan';
    case 'next': return 'Volgende oefening';
    case 'last': return 'Laatste oefening afronden';
    case 'finish': return 'Training afronden';
  }
}

/** Index of the "nu" set: the first set that is neither completed nor skipped, or -1. */
export function activeSetIndex(sets: WorkoutSet[]): number {
  return sets.findIndex(s => !s.completed && !s.skipped);
}

/** Planned sets: a unilateral left/right pair counts once. */
function logicalSetCount(sets: WorkoutSet[]): number {
  return sets.filter(s => s.side !== 'right').length;
}

export function canAddSet(sets: WorkoutSet[]): boolean {
  return logicalSetCount(sets) < MAX_SETS;
}

/**
 * "Laatste set weghalen": never below one set, and never a logged set (for a
 * unilateral pair: not when either side is logged).
 */
export function canRemoveLastSet(sets: WorkoutSet[]): boolean {
  if (logicalSetCount(sets) <= 1) return false;
  const next = removeSetAt(sets, sets.length - 1);
  if (next.length === sets.length) return false;
  const completed = (list: WorkoutSet[]) => list.filter(s => s.completed).length;
  return completed(next) === completed(sets);
}

/** Skip an exercise: every unsettled set becomes skipped, logged sets stay. */
export function skipRemainingSets(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.map(s => (s.completed || s.skipped ? s : { ...s, skipped: true }));
}

/** Put an exercise back: skipped sets that were not performed become open again. */
export function restoreSkippedSets(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.map(s => (s.skipped && !s.completed ? { ...s, skipped: false } : s));
}

export interface AfterSetLogged {
  /** Exercise to show next (stays the same for a solo exercise). */
  focusIdx: number;
  /** Start the rest timer. */
  rest: boolean;
}

/**
 * What happens after a set was logged. For supersets the members alternate
 * without rest, and rest starts only after the last member of a round that leaves open sets. No rest after the last open set of an exercise (or group). Pass the
 * workout as it was *before* the set was completed: the just-finished
 * (exIdx, setIdx) is treated as done here.
 */
export function afterSetLogged(
  exercises: WorkoutExercise[],
  exIdx: number,
  setIdx: number,
): AfterSetLogged {
  const info = groupSupersets(exercises)[exIdx];
  const hasOpenSet = (i: number) =>
    (exercises[i]?.sets ?? []).some(
      (s, sIdx) => !s.completed && !s.skipped && !(i === exIdx && sIdx === setIdx),
    );

  // Solo: rest only while this exercise still has an open set. Unilateral
  // (D1U): only once the logged part completes its left/right set, so not
  // between the left and the right side.
  if (!info || !info.inSuperset) {
    const sets = exercises[exIdx]?.sets ?? [];
    const partner = sets[pairPartnerIndex(sets, setIdx)];
    const setComplete = !partner || partner.completed || partner.skipped;
    return { focusIdx: exIdx, rest: setComplete && hasOpenSet(exIdx) };
  }

  const nextMember = info.members.find(m => m > exIdx && hasOpenSet(m));
  if (nextMember != null) return { focusIdx: nextMember, rest: false };

  const firstOpen = info.members.find(hasOpenSet);
  // No open set left in the whole group: the exercise is done, no rest.
  return { focusIdx: firstOpen ?? exIdx, rest: firstOpen != null };
}

/**
 * Which exercise is current after inserting a new one at `at` (`exercises` is
 * the list *before* the insert; `cur` -1 = klaar-toestand). The new exercise
 * takes over when the current one is finished or not started yet; otherwise
 * the current one stays, with its index shifted.
 */
export function focusAfterInsert(exercises: WorkoutExercise[], cur: number, at: number): number {
  const current = exercises[cur];
  if (!current) return at;
  const settled = current.sets.some(s => s.completed || s.skipped);
  const complete = current.sets.length > 0 && current.sets.every(s => s.completed || s.skipped);
  if (!settled || complete) return at;
  return shiftIndex(cur, at);
}

export interface PrevSetRef {
  weight: number;
  reps: number;
  /** Side of a unilateral set (logged per side). */
  side?: 'left' | 'right';
}

/** 62.5 → "62,5"; null → "" (decimal comma, as in the design). */
export function formatDecimal(n: number | null): string {
  return n === null ? '' : String(n).replace('.', ',');
}

/** "62,5" / "62.5" → 62.5; empty, junk or negative → null. 0 is valid (bodyweight). */
export function parseDecimal(text: string): number | null {
  const n = parseFloat(text.trim().replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** "140 × 8 · 8 · 7" (one weight) or "100 × 8 · 90 × 10" (varying weights). */
export function formatPrevLine(sets: PrevSetRef[]): string {
  if (sets.length === 0) return '';
  const first = sets[0]!;
  if (sets.every(s => s.weight === first.weight)) {
    return `${formatDecimal(first.weight)} × ${sets.map(s => s.reps).join(' · ')}`;
  }
  return sets.map(s => `${formatDecimal(s.weight)} × ${s.reps}`).join(' · ');
}
