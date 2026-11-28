/**
 * Pure rules for the shared exercise edit card (`ExerciseEditCard`), used by
 * the schema editor and the suggested workout.
 */
import { formatReps } from './reps';
import { formatRest } from './restTime';

/**
 * The collapsed one-line summary: `3 × 8-12`, plus `· rust 1:30` and `· 60 kg`
 * when the screen passes them (the schema editor; the suggestion only edits
 * sets and reps).
 */
export function exerciseCardSummary(
  ex: { sets: number; repsPerSet: number; repsMax?: number },
  extras: { restSeconds?: number; weight?: number | null } = {},
): string {
  let text = `${ex.sets} × ${formatReps(ex.repsPerSet, ex.repsMax)}`;
  if (extras.restSeconds != null) text += ` · rust ${formatRest(extras.restSeconds)}`;
  if (extras.weight != null) text += ` · ${extras.weight} kg`;
  return text;
}

/**
 * Which superset action the card offers: none on the first exercise, "unlink"
 * when it is linked to the exercise directly above, else "link".
 */
export function supersetLinkAction(
  index: number,
  info: { inSuperset: boolean; isFirst: boolean } | undefined,
): 'link' | 'unlink' | null {
  if (index <= 0) return null;
  return info?.inSuperset && !info.isFirst ? 'unlink' : 'link';
}

/** Returns a new set with `key` toggled (expanded cards by exercise id). */
export function toggleExpanded(expanded: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(expanded);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
