import type { ExerciseGoal } from '../../../db/index';
import { estimateWeightForReps, type OneRMFormula } from '../hooks/useProgress';

/** Input bounds for a goal (also used by the exercise form's validation). */
export const GOAL_WEIGHT_MAX = 1000; // kg
export const GOAL_REPS_MAX = 50;

/**
 * True when `goal` is a usable goal: a finite weight in (0, GOAL_WEIGHT_MAX] kg
 * and an integer rep count in [1, GOAL_REPS_MAX]. Anything else (missing,
 * half-filled, or malformed data from an old import) counts as "no goal".
 */
export function isValidGoal(goal: unknown): goal is ExerciseGoal {
  if (typeof goal !== 'object' || goal === null) return false;
  const { weight, reps } = goal as Record<string, unknown>;
  return (
    typeof weight === 'number' &&
    Number.isFinite(weight) &&
    weight > 0 &&
    weight <= GOAL_WEIGHT_MAX &&
    typeof reps === 'number' &&
    Number.isInteger(reps) &&
    reps >= 1 &&
    reps <= GOAL_REPS_MAX
  );
}

export interface GoalProgress {
  goal: ExerciseGoal;
  /** Best estimated weight (kg) liftable for `goal.reps` reps; 0 without data. */
  estimatedWeight: number;
  /** `estimatedWeight / goal.weight`, uncapped (≥ 0). */
  ratio: number;
  /** Bar fill 0–100 (integer). Only 100 when the goal is achieved. */
  percent: number;
  achieved: boolean;
}

/** Tolerance for float round-off (e.g. 100 kg × 5 → 1RM → back to 99.99999…). */
const EPSILON = 1e-9;

/**
 * Progress towards a weight × reps goal.
 *
 * Rule: take the exercise's best estimated 1RM (all-time, weighted sets only,
 * with the chosen 1RM formula), convert it back to the weight liftable for the
 * goal's rep count (`estimateWeightForReps`, the inverse of `calculate1RM`; for
 * a 1-rep goal that is the 1RM itself), and divide by the goal weight:
 *
 *   estimatedWeight = estimateWeightForReps(best1RM, goal.reps, formula)
 *   ratio           = estimatedWeight / goal.weight
 *   achieved        = ratio ≥ 1
 *   percent         = achieved ? 100 : min(99, floor(ratio × 100))  (+ tiny epsilon)
 *
 * `percent` is floored and kept below 100 until the goal is actually reached,
 * so the bar never reads "100%" for 99.6%. A missing, non-finite or ≤ 0 best
 * 1RM counts as no progress (0%), never NaN. Returns null for an invalid goal.
 */
export function goalProgress(
  goal: ExerciseGoal | undefined,
  best1RM: number | undefined,
  formula: OneRMFormula,
): GoalProgress | null {
  if (!isValidGoal(goal)) return null;

  const oneRM = typeof best1RM === 'number' && Number.isFinite(best1RM) && best1RM > 0 ? best1RM : 0;
  const raw = oneRM > 0 ? estimateWeightForReps(oneRM, goal.reps, formula) : 0;
  const estimatedWeight = Number.isFinite(raw) && raw > 0 ? raw : 0;
  const ratio = estimatedWeight / goal.weight;
  const achieved = ratio >= 1 - EPSILON;
  const percent = achieved ? 100 : Math.max(0, Math.min(99, Math.floor(ratio * 100 + 1e-6)));

  return { goal, estimatedWeight, ratio, percent, achieved };
}

/**
 * Parses the exercise form's two goal fields. Both empty = no goal (clears it);
 * otherwise both are required: weight in (0, GOAL_WEIGHT_MAX] kg (a decimal
 * comma is accepted) and reps an integer in [1, GOAL_REPS_MAX]. Returns a Dutch
 * error message for invalid input.
 */
export function parseGoalInput(
  weightText: string,
  repsText: string,
): { goal: ExerciseGoal | undefined; error: null } | { goal: undefined; error: string } {
  const w = weightText.trim().replace(',', '.');
  const r = repsText.trim();
  if (w === '' && r === '') return { goal: undefined, error: null };
  if (w === '' || r === '') {
    return { goal: undefined, error: 'Vul voor een doel zowel gewicht als herhalingen in.' };
  }
  // Store at most 2 decimals (lb-based steps give e.g. 22.68 kg).
  const weight = Math.round(Number(w) * 100) / 100;
  const reps = Number(r);
  if (!Number.isFinite(weight) || weight <= 0 || weight > GOAL_WEIGHT_MAX) {
    return { goal: undefined, error: `Doelgewicht moet tussen 0 en ${GOAL_WEIGHT_MAX} kg liggen.` };
  }
  if (!Number.isInteger(reps) || reps < 1 || reps > GOAL_REPS_MAX) {
    return { goal: undefined, error: `Doelherhalingen moet een heel getal van 1 t/m ${GOAL_REPS_MAX} zijn.` };
  }
  return { goal: { weight, reps }, error: null };
}
