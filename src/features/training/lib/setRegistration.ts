import type { WorkoutSet } from '../../../db/index';
import { activeSetIndex, canRemoveLastSet, formatDecimal, type PrevSetRef } from './liveTraining';
import { pairPartnerIndex } from './sets';

/**
 * Pure logic of the B1 set registration (DESIGN §4 "Set-voortgang", "Set-kaart",
 * "Gedaan-lijst met verschil", "Rust-ring"; §6 "Geopende set"). Indices are
 * indices into the exercise's `sets` array; a unilateral left/right pair shares
 * one logical set number (one dot in B1).
 *
 * Unilateral exercises (D1U, `TrainingD1U.dc.html`, DESIGN §4 "Set-voortgang,
 * unilateraal" + §6): the design's set `{weight, left, right}` maps onto the
 * stored left row + right row of the same logical set. Each row is one part
 * (dot) of the zigzag L1 → R1 → L2 → R2; the part index is the row index.
 */

const settled = (s: WorkoutSet) => s.completed || s.skipped;

/**
 * The set shown in the set card: the selected set (`sel`) while it exists,
 * else the first open set, else -1 (all settled, nothing opened).
 */
export function openSetIndex(sets: WorkoutSet[], sel: number | null): number {
  if (sel !== null && sel >= 0 && sel < sets.length) return sel;
  return activeSetIndex(sets);
}

/** After logging `loggedIdx`: the first open set after it, else before it, else -1. */
export function nextOpenSetIndex(sets: WorkoutSet[], loggedIdx: number): number {
  for (let i = loggedIdx + 1; i < sets.length; i++) if (!settled(sets[i]!)) return i;
  for (let i = 0; i < loggedIdx && i < sets.length; i++) if (!settled(sets[i]!)) return i;
  return -1;
}

/** 1-based set number shown to the user (a left/right pair counts once). */
export function logicalSetNumber(sets: WorkoutSet[], idx: number): number {
  let n = 0;
  for (let i = 0; i <= idx && i < sets.length; i++) if (sets[i]!.side !== 'right') n++;
  return Math.max(1, n);
}

/** The sets are logged per side (a unilateral exercise): show the zigzag (D1U). */
export function isUnilateral(sets: WorkoutSet[]): boolean {
  return sets.some(s => s.side !== undefined);
}

/** Indices per logical set: `[[0], [1], …]`, or `[[0, 1], [2, 3], …]` for pairs. */
function logicalGroups(sets: { side?: 'left' | 'right' }[]): number[][] {
  const groups: number[][] = [];
  sets.forEach((s, i) => {
    const last = groups[groups.length - 1];
    if (s.side === 'right' && last && sets[last[last.length - 1]!]?.side === 'left') last.push(i);
    else groups.push([i]);
  });
  return groups;
}

/**
 * Logged / planned sets for the overview ("2/3 sets"): a unilateral set counts
 * once and only when both sides are logged.
 */
export function setProgress(sets: WorkoutSet[]): { done: number; total: number } {
  const groups = logicalGroups(sets);
  return { done: groups.filter(g => g.every(i => sets[i]!.completed)).length, total: groups.length };
}

export type DotState = 'done' | 'open' | 'todo';

const SIDE_NAME = { left: 'links', right: 'rechts' } as const;

export interface SetDot {
  number: number;
  state: DotState;
  /** The line in front of this dot is accent: the set before it is done. */
  lineOn: boolean;
  /** `aria-pressed`: this set is in the set card. */
  pressed: boolean;
  /** Set index to open on tap (first open side of a pair, else its first side). */
  target: number;
  ariaLabel: string;
}

/** The set-progress row (dots). `openIdx` = `openSetIndex(...)`. */
export function setDots(sets: WorkoutSet[], openIdx: number): SetDot[] {
  const groups = logicalGroups(sets);
  const isDone = (g: number[]) => g.every(i => sets[i]!.completed);
  return groups.map((g, n) => {
    const done = isDone(g);
    const open = g.includes(openIdx);
    const skipped = !done && g.every(i => settled(sets[i]!));
    const prev = groups[n - 1];
    return {
      number: n + 1,
      state: open ? 'open' : done ? 'done' : 'todo',
      lineOn: !!prev && isDone(prev),
      pressed: open,
      target: g.find(i => !settled(sets[i]!)) ?? g[0]!,
      ariaLabel: `Set ${n + 1}${done ? ' (klaar), aanpassen' : skipped ? ' (overgeslagen)' : ''}`,
    };
  });
}

export interface SideDot {
  /** Set index (= part index k: 0 = L1, 1 = R1, 2 = L2, …); opened on tap. */
  index: number;
  /** 1-based set number shown in the dot. */
  number: number;
  side: 'left' | 'right';
  state: DotState;
  /** The line starting at this part (towards the next one) is accent: this part is done. */
  lineOn: boolean;
  pressed: boolean;
  ariaLabel: string;
}

/** The zigzag set progress of a unilateral exercise: one dot per part (D1U). */
export function sideDots(sets: WorkoutSet[], openIdx: number): SideDot[] {
  return sets.map((s, i) => {
    const number = logicalSetNumber(sets, i);
    const side = s.side ?? 'left';
    const status = s.completed ? ' (klaar), aanpassen' : s.skipped ? ' (overgeslagen)' : '';
    return {
      index: i,
      number,
      side,
      state: i === openIdx ? 'open' : s.completed ? 'done' : 'todo',
      lineOn: s.completed,
      pressed: i === openIdx,
      ariaLabel: `Set ${number} ${SIDE_NAME[side]}${status}`,
    };
  });
}

export interface ZigzagLine {
  /** Start (centre of the part it leaves from). */
  x: number;
  y: number;
  length: number;
  /** Degrees, rotated around the start. */
  angle: number;
}

export interface ZigzagLayout {
  step: number;
  /** Centre per part, plus one extra slot for the plus dot (top row). */
  points: { x: number; y: number }[];
  /** Line from each centre to the next one (`lines[k]` leaves part k). */
  lines: ZigzagLine[];
  /** Track width up to the end of the plus slot (the 22 px right padding comes on top). */
  width: number;
}

const ZIGZAG_GUTTER = 24;
const ZIGZAG_STEP = 46;
const ZIGZAG_ROW_Y = { left: 16, right: 46 } as const;

/**
 * Positions of the zigzag (DESIGN §4, schuifbare set-rij): centre x of part k =
 * `24 + k × 46 + 23`, y 16 (left, top row) or 46 (right). The step is fixed:
 * with many sets the row scrolls instead of shrinking, so the 44 px tap targets
 * of horizontal neighbours never overlap (§12 q13).
 */
export function zigzagLayout(parts: number): ZigzagLayout {
  const slots = parts + 1;
  const step = ZIGZAG_STEP;
  const points = Array.from({ length: slots }, (_, k) => ({
    x: ZIGZAG_GUTTER + k * step + step / 2,
    y: k % 2 === 0 ? ZIGZAG_ROW_Y.left : ZIGZAG_ROW_Y.right,
  }));
  const lines = points.slice(0, -1).map((p, k) => {
    const q = points[k + 1]!;
    return {
      x: p.x,
      y: p.y,
      length: Math.hypot(q.x - p.x, q.y - p.y),
      angle: (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI,
    };
  });
  return { step, points, lines, width: ZIGZAG_GUTTER + slots * step };
}

export type DeltaKind = 'up' | 'down' | 'same' | 'new';

export interface SetDelta {
  kind: DeltaKind;
  text: string;
}

/** Round away float noise (0.1 + 0.2) before comparing weights. */
const kg = (n: number) => Math.round(n * 100) / 100;

/**
 * Difference with the same set of the previous session (DESIGN §4): reps at
 * the same weight (`↑ +1`, `gelijk`, `↓ 1`), kg at another weight
 * (`↑ +2,5 kg`), `nieuw` without a previous set. No 1RM (decision on §12 q10).
 */
export function setDelta(cur: PrevSetRef, prev: PrevSetRef | undefined): SetDelta {
  if (!prev) return { kind: 'new', text: 'nieuw' };
  const dw = kg(cur.weight - prev.weight);
  if (dw === 0) return repsDelta(cur.reps - prev.reps);
  return dw > 0
    ? { kind: 'up', text: `↑ +${formatDecimal(dw)} kg` }
    : { kind: 'down', text: `↓ ${formatDecimal(Math.abs(dw))} kg` };
}

function repsDelta(d: number): SetDelta {
  if (d > 0) return { kind: 'up', text: `↑ +${d}` };
  if (d < 0) return { kind: 'down', text: `↓ ${Math.abs(d)}` };
  return { kind: 'same', text: 'gelijk' };
}

export interface PairRef {
  left: PrevSetRef;
  right: PrevSetRef;
}

/**
 * Difference of a unilateral set with the same set last time (DESIGN §6,
 * decision on §12 q10): same weight → the reps difference of left + right
 * summed; another weight → the kg difference; no full previous set → `nieuw`.
 * Sides with different weights: the kg differences of both sides are added.
 */
export function pairDelta(cur: PairRef, prev: PairRef | undefined): SetDelta {
  if (!prev) return { kind: 'new', text: 'nieuw' };
  const dwL = kg(cur.left.weight - prev.left.weight);
  const dwR = kg(cur.right.weight - prev.right.weight);
  const dw = dwL === dwR ? dwL : kg(dwL + dwR);
  if (dw === 0) return repsDelta(cur.left.reps - prev.left.reps + (cur.right.reps - prev.right.reps));
  return dw > 0
    ? { kind: 'up', text: `↑ +${formatDecimal(dw)} kg` }
    : { kind: 'down', text: `↓ ${formatDecimal(Math.abs(dw))} kg` };
}

/** Full left/right pairs of a list of sides, per logical set (`undefined` = not a full pair). */
function pairsOf<T extends { side?: 'left' | 'right' }>(list: T[]): ({ left: T; right: T } | undefined)[] {
  return logicalGroups(list).map(g => {
    const left = g.map(i => list[i]!).find(x => x.side === 'left');
    const right = g.map(i => list[i]!).find(x => x.side === 'right');
    return left && right ? { left, right } : undefined;
  });
}

export interface DoneRow {
  /** Set index to open on tap. */
  index: number;
  label: string;
  delta: SetDelta;
  ariaLabel: string;
}

/**
 * The "Gedaan" list: one row per completed set, compared with the set at the
 * same position last time (`prevSets` in session order, per side for
 * unilateral exercises). A set without weight counts as 0 kg (bodyweight).
 */
export function doneRows(sets: WorkoutSet[], prevSets: PrevSetRef[]): DoneRow[] {
  if (isUnilateral(sets)) return unilateralDoneRows(sets, prevSets);
  const rows: DoneRow[] = [];
  sets.forEach((s, i) => {
    if (!s.completed) return;
    const weight = s.weight ?? 0;
    const reps = s.actualReps ?? 0;
    const name = `Set ${logicalSetNumber(sets, i)}${s.side ? ` ${SIDE_NAME[s.side]}` : ''}`;
    const delta = setDelta({ weight, reps }, prevSets[i]);
    rows.push({
      index: i,
      label: `${name} · ${formatDecimal(weight)} kg × ${reps}`,
      delta,
      // Visible text first (label-in-name), then the action as in the design.
      ariaLabel: `${name} · ${formatDecimal(weight)} kg × ${reps}, ${delta.text}, aanpassen`,
    });
  });
  return rows;
}

export interface DoneListState {
  /** Index of the exercise the list belongs to. */
  exercise: number;
  /** Number of logged rows. */
  count: number;
}

/**
 * The Gedaan list shows every logged set, newest at the bottom, in its own
 * scroll area (owner decision, deviates from "the last 3" in DESIGN §5). It
 * jumps to the bottom only when an exercise is opened or a new set is logged,
 * never on other updates, so someone who scrolled up to an older set stays put.
 */
export function doneListScrollToBottom(prev: DoneListState | null, next: DoneListState): boolean {
  if (!prev || prev.exercise !== next.exercise) return true;
  return next.count > prev.count;
}

/**
 * D1U Gedaan list: one row per set whose left and right parts are both logged
 * (`Set 1 · 20 kg · L 12 · R 12`); a half-finished set is not listed. The row
 * opens the left part. Compared with the same logical set last time.
 */
function unilateralDoneRows(sets: WorkoutSet[], prevSets: PrevSetRef[]): DoneRow[] {
  const prevPairs = pairsOf(prevSets);
  const ref = (s: WorkoutSet): PrevSetRef => ({ weight: s.weight ?? 0, reps: s.actualReps ?? 0 });
  const rows: DoneRow[] = [];
  logicalGroups(sets).forEach((g, n) => {
    if (!g.every(i => sets[i]!.completed)) return;
    const name = `Set ${n + 1}`;
    const left = g.find(i => sets[i]!.side === 'left');
    const right = g.find(i => sets[i]!.side === 'right');
    if (left === undefined || right === undefined) {
      // A side without its partner (should not happen): list it on its own.
      const s = sets[g[0]!]!;
      const side = s.side ? ` ${SIDE_NAME[s.side]}` : '';
      const delta = setDelta(ref(s), undefined);
      const label = `${name}${side} · ${formatDecimal(ref(s).weight)} kg × ${ref(s).reps}`;
      rows.push({ index: g[0]!, label, delta, ariaLabel: `${label}, ${delta.text}, aanpassen` });
      return;
    }
    const l = ref(sets[left]!);
    const r = ref(sets[right]!);
    const label =
      kg(l.weight) === kg(r.weight)
        ? `${name} · ${formatDecimal(l.weight)} kg · L ${l.reps} · R ${r.reps}`
        : `${name} · L ${formatDecimal(l.weight)} kg × ${l.reps} · R ${formatDecimal(r.weight)} kg × ${r.reps}`;
    const prev = prevPairs[n];
    const delta = pairDelta({ left: l, right: r }, prev && { left: prev.left, right: prev.right });
    rows.push({ index: left, label, delta, ariaLabel: `${label}, ${delta.text}, aanpassen` });
  });
  return rows;
}

/**
 * Values the set card starts with for the opened set: a logged set shows its
 * own values; an open set gets the last logged set of this session (so the
 * next set after "Set klaar" carries the values over), else its own value or
 * plan, else the same set of the previous session. `null` = unknown.
 * Unilateral (D1U): an open part whose other side is logged gets that side's
 * values first (after the left part the right part starts with the same reps).
 */
export function openSetValues(
  sets: WorkoutSet[],
  idx: number,
  prevSets: PrevSetRef[],
): { weight: number | null; reps: number | null } {
  const opened = sets[idx];
  if (opened?.completed) return { weight: opened.weight ?? 0, reps: opened.actualReps };
  // A set that was logged and put back ("Set terugzetten") keeps its own values.
  if (opened && opened.actualReps != null && opened.actualReps > 0) {
    return { weight: opened.weight ?? 0, reps: opened.actualReps };
  }
  const partner = sets[pairPartnerIndex(sets, idx)];
  if (partner?.completed && partner.actualReps != null && partner.actualReps > 0) {
    return { weight: partner.weight ?? 0, reps: partner.actualReps };
  }
  for (let i = sets.length - 1; i >= 0; i--) {
    const s = sets[i]!;
    if (s.completed && s.actualReps != null && s.actualReps > 0 && s.weight != null) {
      return { weight: s.weight, reps: s.actualReps };
    }
  }
  const prev = prevSets[idx] ?? prevSets[0];
  return {
    weight: opened?.weight ?? opened?.plannedWeight ?? prev?.weight ?? null,
    reps: opened?.actualReps ?? opened?.plannedReps ?? prev?.reps ?? null,
  };
}

/**
 * "Set verwijderen" (decision on DESIGN §12 q9): only on the opened last set
 * (either side of a pair) while it is not logged, never the only set.
 */
export function canRemoveOpenSet(sets: WorkoutSet[], openIdx: number): boolean {
  const groups = logicalGroups(sets);
  const last = groups[groups.length - 1];
  if (!last || !last.includes(openIdx)) return false;
  return canRemoveLastSet(sets);
}

// --- Rest ring ---

/** Part of the rest that is left, 0..1 (the ring runs empty). */
export function restRingFraction(remaining: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, remaining / total));
}

/** 72 → "1:12". */
export function formatRestClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function spokenDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} seconden`;
  const min = `${m} ${m === 1 ? 'minuut' : 'minuten'}`;
  return r === 0 ? min : `${min} ${r}`;
}

/** Button label of the ring (DESIGN §4): a tap opens the rest bar (running or idle). */
export function restRingLabel(seconds: number, running: boolean): string {
  return running
    ? `Rust, nog ${spokenDuration(seconds)}. Tik om de rust in te stellen`
    : `Rust ${spokenDuration(seconds)}. Tik om de rust in te stellen`;
}

/**
 * Text in the idle ring: 0:00 right after a rest ran out (§6), else on a
 * unilateral exercise "na R" (D1U: the rest follows after the right part),
 * else the rest duration.
 */
export function restRingIdleText(seconds: number, ended: boolean, unilateral: boolean): string {
  if (ended) return formatRestClock(0);
  return unilateral ? 'na R' : formatRestClock(seconds);
}

/** Button label of the idle ring; a tap opens the rest bar (which can start the rest by hand). */
export function restRingIdleLabel(seconds: number, unilateral: boolean): string {
  return unilateral
    ? `Rust volgt na rechts (${spokenDuration(seconds)}). Tik om de rust in te stellen`
    : restRingLabel(seconds, false);
}

/** Label of the `role="timer"` element while resting: "Rust nog 1 minuut 12 seconden". */
export function restTimerLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `Rust nog ${m} ${m === 1 ? 'minuut' : 'minuten'} ${s % 60} seconden`;
}
