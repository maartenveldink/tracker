/**
 * Formats a rep prescription. Shows a range (e.g. "8-12") when a valid
 * upper bound is given, otherwise the fixed rep count.
 */
export function formatReps(repsPerSet: number, repsMax?: number): string {
  return repsMax && repsMax > repsPerSet ? `${repsPerSet}-${repsMax}` : `${repsPerSet}`;
}
