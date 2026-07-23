import type { Equipment, Exercise, WeightStepSetting } from '../../../db/index';

/** Exact pound → kilogram conversion factor. */
const LB_TO_KG = 0.45359237;

/**
 * Default weight increment per equipment type. Used for fresh installs and as a
 * fallback when a setting is missing:
 * - cable: 5 lb stacks (≈2.268 kg)
 * - dumbbell (halter): even kilos
 * - plates (halterschijven): 1.25 kg discs
 * - other: whole kilos.
 * These are user-configurable in Settings (`AppSettings.weightSteps`).
 */
export const DEFAULT_WEIGHT_STEPS: Record<Equipment, WeightStepSetting> = {
  cable: { value: 5, unit: 'lb' },
  dumbbell: { value: 2, unit: 'kg' },
  plates: { value: 1.25, unit: 'kg' },
  other: { value: 1, unit: 'kg' },
};

/** Increment used when an exercise has no equipment set. */
export const DEFAULT_EQUIPMENT: Equipment = 'other';

/** Preset increments offered in Settings, per equipment type. */
export const WEIGHT_STEP_PRESETS: WeightStepSetting[] = [
  { value: 1, unit: 'kg' },
  { value: 1.25, unit: 'kg' },
  { value: 2, unit: 'kg' },
  { value: 2.5, unit: 'kg' },
  { value: 5, unit: 'kg' },
  { value: 1.25, unit: 'lb' },
  { value: 2.5, unit: 'lb' },
  { value: 5, unit: 'lb' },
];

/** Number of decimals in a plain number literal (2.5 → 1, 1.25 → 2, 3 → 0). */
function decimalPlaces(n: number): number {
  if (Number.isInteger(n)) return 0;
  return n.toString().split('.')[1]?.length ?? 0;
}

/**
 * Resolves a configured step into a kilogram grid size plus the decimals to
 * round to. Pound steps convert to kg and always show 1 decimal; kilogram steps
 * keep the precision of the configured value.
 */
export function resolveStep(step: WeightStepSetting): { stepKg: number; decimals: number } {
  if (step.unit === 'lb') return { stepKg: step.value * LB_TO_KG, decimals: 1 };
  return { stepKg: step.value, decimals: decimalPlaces(step.value) };
}

/** The configured step for an exercise's equipment, falling back to the defaults. */
export function weightStepFor(
  weightSteps: Record<Equipment, WeightStepSetting> | undefined,
  equipment: Equipment | undefined,
): WeightStepSetting {
  const key = equipment ?? DEFAULT_EQUIPMENT;
  return weightSteps?.[key] ?? DEFAULT_WEIGHT_STEPS[key];
}

/**
 * The effective step for an exercise: its own `weightStep` override if set,
 * otherwise the step configured for its equipment type.
 */
export function weightStepForExercise(
  exercise: Pick<Exercise, 'weightStep' | 'equipment'> | undefined,
  weightSteps: Record<Equipment, WeightStepSetting> | undefined,
): WeightStepSetting {
  return exercise?.weightStep ?? weightStepFor(weightSteps, exercise?.equipment);
}

/** A comparable key for a step, e.g. "2.5-lb" — handy for `<select>` values. */
export function weightStepKey(step: WeightStepSetting): string {
  return `${step.value}-${step.unit}`;
}

/** Human label like "2,5 kg" or "5 lb (≈2,3 kg)". */
export function weightStepLabel(step: WeightStepSetting): string {
  const value = step.value.toLocaleString('nl-NL');
  if (step.unit === 'kg') return `${value} kg`;
  const kg = (step.value * LB_TO_KG).toLocaleString('nl-NL', { maximumFractionDigits: 1 });
  return `${value} lb (≈${kg} kg)`;
}

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/**
 * Next weight when stepping up (`dir = 1`) or down (`dir = -1`), snapped to the
 * step's grid so the result is always a valid loadable weight. Never returns
 * below 0.
 */
export function steppedWeight(
  current: number | null | undefined,
  dir: 1 | -1,
  step: WeightStepSetting,
): number {
  const { stepKg, decimals } = resolveStep(step);
  const multiples = Math.round((current ?? 0) / stepKg);
  const next = Math.max(0, (multiples + dir) * stepKg);
  return roundTo(next, decimals);
}

/**
 * Best-guess equipment from an exercise's name + description. Order matters:
 * "halterschijven" contains "halter", so plates are matched before dumbbells.
 */
export function detectEquipment(text: string): Equipment {
  const t = text.toLowerCase();
  if (t.includes('cable') || t.includes('kabel')) return 'cable';
  if (t.includes('barbell') || t.includes('halterschijf') || t.includes('halterschijven')) return 'plates';
  if (t.includes('dumbbell') || t.includes('halter')) return 'dumbbell';
  return 'other';
}
