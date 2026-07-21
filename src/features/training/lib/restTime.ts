import type { AppSettings, Exercise } from '../../../db/index';

export const REST_STEP = 15;
export const REST_MIN = 15;
export const REST_MAX = 600;

/** Default rest (seconds) per laterality × movement-type combination. */
export const DEFAULT_REST_MATRIX = {
  bilateralCompound: 180,
  unilateralCompound: 90,
  bilateralIsolation: 60,
  unilateralIsolation: 15,
} as const;

type RestSettings = Pick<AppSettings, 'restTimerSeconds' | 'restDefaults'>;

/** Formats seconds as `M:SS` (e.g. 90 → "1:30"). */
export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Clamps a rest value to the allowed 15–600s range. */
export function clampRest(seconds: number): number {
  return Math.max(REST_MIN, Math.min(REST_MAX, seconds));
}

/**
 * Default rest derived from the exercise's laterality and movement type
 * (bilateral/unilateral × compound/isolation). When either is unknown, falls
 * back to the global default rest.
 */
export function movementDefaultRest(
  laterality: Exercise['laterality'],
  movementType: Exercise['movementType'],
  settings: RestSettings,
): number {
  if (!laterality || !movementType) return settings.restTimerSeconds;
  const m = settings.restDefaults;
  if (movementType === 'compound') {
    return laterality === 'bilateral' ? m.bilateralCompound : m.unilateralCompound;
  }
  return laterality === 'bilateral' ? m.bilateralIsolation : m.unilateralIsolation;
}

/**
 * Effective rest time between sets, resolved from specific to general:
 * 1) schema-exercise override, 2) per-exercise default, 3) laterality/movement
 * default, 4) global setting. The first value that is set wins.
 */
export function resolveRestSeconds(args: {
  schemaRestSeconds?: number;
  exercise?: Pick<Exercise, 'restTimerSeconds' | 'laterality' | 'movementType'>;
  settings: RestSettings;
}): number {
  const { schemaRestSeconds, exercise, settings } = args;
  if (schemaRestSeconds !== undefined) return schemaRestSeconds;
  if (exercise?.restTimerSeconds !== undefined) return exercise.restTimerSeconds;
  return movementDefaultRest(exercise?.laterality, exercise?.movementType, settings);
}
