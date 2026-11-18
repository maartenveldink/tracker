import type { WorkoutSet } from '../../../db/index';
import { calculate1RM, type OneRMFormula } from '../hooks/useProgress';
import { activeSetIndex } from './liveTraining';
import { isWeightedSet } from './sets';

/**
 * Pure logic behind the "Oefening klaar" celebration (DESIGN §8, plan
 * decision 2): an exercise is "better than last time" when the *average*
 * estimated 1RM over its weighted sets beats that of the previous session.
 * No previous session (new exercise) means no celebration.
 */

export interface SetLine {
  weight: number;
  reps: number;
}

export interface ComparisonRow {
  today: SetLine | null;
  previous: SetLine | null;
  /** today.reps - previous.reps; null when either side is missing. */
  repsDiff: number | null;
}

export interface SessionComparison {
  improved: boolean;
  todayAvg: number;
  previousAvg: number;
  /** Total reps today minus previous session (can be negative). */
  repsDelta: number;
  /** Total volume (kg) today minus previous session. */
  volumeDelta: number;
  rows: ComparisonRow[];
}

const usable = (s: SetLine) => s.weight > 0 && s.reps > 0;

/** Average estimated 1RM over weighted sets; 0 when there are none. */
export function averageOneRM(sets: SetLine[], formula: OneRMFormula): number {
  const valid = sets.filter(usable);
  if (valid.length === 0) return 0;
  return valid.reduce((sum, s) => sum + calculate1RM(s.weight, s.reps, formula), 0) / valid.length;
}

const totalReps = (sets: SetLine[]) => sets.reduce((n, s) => n + s.reps, 0);
const totalVolume = (sets: SetLine[]) => sets.reduce((n, s) => n + s.weight * s.reps, 0);

/**
 * Compare today's weighted sets with the previous session. Returns null when
 * there is nothing to compare (no previous session or no weighted sets today).
 */
export function compareSessions(
  today: SetLine[],
  previous: SetLine[] | null,
  formula: OneRMFormula,
): SessionComparison | null {
  if (!previous) return null;
  const t = today.filter(usable);
  const p = previous.filter(usable);
  if (t.length === 0 || p.length === 0) return null;

  const todayAvg = averageOneRM(t, formula);
  const previousAvg = averageOneRM(p, formula);
  const rows: ComparisonRow[] = [];
  for (let i = 0; i < Math.max(t.length, p.length); i++) {
    const a = t[i] ?? null;
    const b = p[i] ?? null;
    rows.push({ today: a, previous: b, repsDiff: a && b ? a.reps - b.reps : null });
  }
  return {
    improved: todayAvg > previousAvg,
    todayAvg,
    previousAvg,
    repsDelta: totalReps(t) - totalReps(p),
    volumeDelta: Math.round((totalVolume(t) - totalVolume(p)) * 100) / 100,
    rows,
  };
}

/** The weighted sets of an exercise, as input for the comparison. */
export function weightedLines(sets: WorkoutSet[]): SetLine[] {
  return sets.filter(isWeightedSet).map(s => ({ weight: s.weight!, reps: s.actualReps! }));
}

/**
 * Trigger for the one-off effects (fireworks, vibration): this change settled
 * the last open set of the exercise, and the result beats the previous session.
 * It looks at the change itself, not at which exercise is on screen: a superset
 * member is finished while the focus moves on to its partner, and returning to
 * a finished exercise or reloading changes nothing, so neither replays.
 */
export function finishedBetterThanLastTime(
  before: WorkoutSet[],
  after: WorkoutSet[],
  previous: SetLine[] | null,
  formula: OneRMFormula,
): boolean {
  const justFinished = activeSetIndex(before) >= 0 && after.length > 0 && activeSetIndex(after) < 0;
  if (!justFinished) return false;
  return compareSessions(weightedLines(after), previous, formula)?.improved ?? false;
}

export type ConfettiShape = 'rect' | 'circle' | 'triangle';
export type ConfettiColor = 'accent' | 'accent-2' | 'text' | 'coral' | 'amber';

export interface ConfettiPiece {
  shape: ConfettiShape;
  color: ConfettiColor;
  /** px, 6-10 */
  size: number;
  /** degrees, -170..-10 (upwards) */
  angle: number;
  /** burst distance in px, 100-270 */
  distance: number;
  /** start delay in seconds, 0-0.18 */
  delay: number;
  /** spin in degrees */
  spin: number;
}

/** Small seeded PRNG (mulberry32) so the confetti looks identical every time. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHAPES: ConfettiShape[] = ['rect', 'circle', 'triangle'];
const COLORS: ConfettiColor[] = ['accent', 'accent-2', 'text', 'coral', 'amber'];

export function confettiPieces(count = 40): ConfettiPiece[] {
  const rand = mulberry32(20240517);
  return Array.from({ length: count }, (_, i) => ({
    shape: SHAPES[i % 3]!,
    color: COLORS[i % 5]!,
    size: 6 + Math.round(rand() * 4),
    angle: -170 + rand() * 160,
    distance: 100 + rand() * 170,
    delay: rand() * 0.18,
    spin: Math.round((rand() - 0.5) * 720),
  }));
}
