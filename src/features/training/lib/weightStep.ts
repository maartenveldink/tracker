import type { Equipment } from '../../../db/index';

/** Exact pound → kilogram conversion factor. */
const LB_TO_KG = 0.45359237;

interface EquipmentStep {
  /** Increment size in kg. */
  stepKg: number;
  /** Decimals to round a stepped weight to (matches how the plates load). */
  decimals: number;
  /** Short label for the UI. */
  label: string;
}

/**
 * Weight increment per equipment type. Values are snapped to a grid of
 * multiples of `stepKg` so repeated +/- taps stay clean:
 * - cable: 5 lb stacks (≈2.268 kg) → 2.3, 4.5, 6.8, … (1 decimal)
 * - dumbbell (halter): even kilos → 2, 4, 6, …
 * - plates (halterschijven): 1.25 kg discs → 1.25, 2.5, 3.75, …
 * - other: whole kilos.
 */
export const EQUIPMENT_STEP: Record<Equipment, EquipmentStep> = {
  cable: { stepKg: 5 * LB_TO_KG, decimals: 1, label: 'Cable (5 lb)' },
  dumbbell: { stepKg: 2, decimals: 0, label: 'Halter (2 kg)' },
  plates: { stepKg: 1.25, decimals: 2, label: 'Halterschijven (1,25 kg)' },
  other: { stepKg: 1, decimals: 0, label: 'Overig (1 kg)' },
};

/** Increment used when an exercise has no equipment set. */
export const DEFAULT_EQUIPMENT: Equipment = 'other';

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/**
 * Next weight when stepping up (`dir = 1`) or down (`dir = -1`), snapped to the
 * equipment's grid so the result is always a valid loadable weight. Never
 * returns below 0.
 */
export function steppedWeight(
  current: number | null | undefined,
  dir: 1 | -1,
  equipment: Equipment | undefined,
): number {
  const { stepKg, decimals } = EQUIPMENT_STEP[equipment ?? DEFAULT_EQUIPMENT];
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
