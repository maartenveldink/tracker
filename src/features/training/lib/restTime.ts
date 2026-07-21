import type { AppSettings, Exercise } from '../../../db/index';

export const REST_STEP = 15;
export const REST_MIN = 15;
export const REST_MAX = 600;

type RestSettings = Pick<AppSettings, 'restTimerSeconds' | 'bilateralRestExtraSeconds'>;

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
 * Laterality-derived default rest (LAT-04): a bilateral exercise gets the
 * configurable extra added on top of the global default (capped at REST_MAX);
 * unilateral or unknown falls back to the global default.
 */
export function lateralityDefaultRest(
  laterality: Exercise['laterality'],
  settings: RestSettings,
): number {
  if (laterality === 'bilateral') {
    return Math.min(REST_MAX, settings.restTimerSeconds + settings.bilateralRestExtraSeconds);
  }
  return settings.restTimerSeconds;
}

/**
 * Effective rest time between sets, resolved from specific to general (E3-15):
 * 1) schema-exercise override, 2) per-exercise default, 3) laterality default,
 * 4) global setting. The first value that is set wins.
 */
export function resolveRestSeconds(args: {
  schemaRestSeconds?: number;
  exercise?: Pick<Exercise, 'restTimerSeconds' | 'laterality'>;
  settings: RestSettings;
}): number {
  const { schemaRestSeconds, exercise, settings } = args;
  if (schemaRestSeconds !== undefined) return schemaRestSeconds;
  if (exercise?.restTimerSeconds !== undefined) return exercise.restTimerSeconds;
  return lateralityDefaultRest(exercise?.laterality, settings);
}
