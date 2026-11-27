/**
 * Rust-balk (DESIGN §4 "Rust-balk", §6, §12 q17): a tap on the rest ring opens a
 * full-width bar with −/+ to set the rest. An adjustment changes the running rest
 * and the rest duration for the remaining sets of this exercise in this workout
 * only (session state, never written back to the schema/exercise/settings).
 */

/** One tap on − or + changes the rest by this much. */
export const REST_STEP_SECONDS = 15;
/** The rest duration never goes below this. */
export const MIN_REST_SECONDS = 15;
/** Upper bound of the rest duration (same as the per-exercise rest control). */
export const MAX_REST_SECONDS = 600;
/** The bar closes by itself this long after the last adjustment (each tap restarts it). */
export const REST_BAR_AUTO_CLOSE_MS = 3000;

export interface RunningRest {
  remaining: number;
  total: number;
  startedAt: number;
}

/** New rest duration after one step (dir = +1 longer, −1 shorter), within 15..600 s. */
export function adjustRestDuration(seconds: number, dir: 1 | -1): number {
  return Math.min(MAX_REST_SECONDS, Math.max(MIN_REST_SECONDS, seconds + dir * REST_STEP_SECONDS));
}

/**
 * The running rest after one step. The countdown is timestamp based
 * (remaining = total − elapsed), so the total moves along with the remaining
 * time. The remaining time can reach 0: the rest then ends on the next tick
 * (with the normal end alert), it never goes negative.
 */
export function adjustRunningRest<T extends RunningRest>(timer: T, dir: 1 | -1): T {
  const remaining = Math.max(0, timer.remaining + dir * REST_STEP_SECONDS);
  return { ...timer, remaining, total: timer.total + (remaining - timer.remaining) };
}

/** Time in the bar: the remaining rest while resting, else the set rest duration. */
export function restBarSeconds(timer: RunningRest | null, durationSeconds: number): number {
  return timer ? timer.remaining : durationSeconds;
}

/** Rest duration of an exercise: its session override (rest bar) first, else the normal resolution. */
export function sessionRestSeconds(
  overrides: Readonly<Record<string, number>>,
  exerciseId: string,
  resolved: number,
): number {
  return overrides[exerciseId] ?? resolved;
}

/**
 * Label of the time button in the middle of the bar. Resting: it only closes the
 * bar. Idle: it is the "second tap" of §6 that starts the rest by hand.
 */
export function restBarCenterLabel(running: boolean): string {
  return running ? 'Klaar met rust instellen' : 'Klaar met rust instellen en rust starten';
}
