import type { WorkoutSet } from '../../../db/index';
import { activeSetIndex, canRemoveLastSet, formatDecimal, type PrevSetRef } from './liveTraining';

/**
 * Pure logic of the B1 set registration (DESIGN §4 "Set-voortgang", "Set-kaart",
 * "Gedaan-lijst met verschil", "Rust-ring"; §6 "Geopende set"). Indices are
 * indices into the exercise's `sets` array; a unilateral left/right pair shares
 * one logical set number (one dot).
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

/** Indices per logical set: `[[0], [1], …]`, or `[[0, 1], [2, 3], …]` for pairs. */
function logicalGroups(sets: WorkoutSet[]): number[][] {
  const groups: number[][] = [];
  sets.forEach((s, i) => {
    const last = groups[groups.length - 1];
    if (s.side === 'right' && last && sets[last[last.length - 1]!]?.side === 'left') last.push(i);
    else groups.push([i]);
  });
  return groups;
}

export type DotState = 'done' | 'open' | 'todo';

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
  if (dw === 0) {
    const d = cur.reps - prev.reps;
    if (d > 0) return { kind: 'up', text: `↑ +${d}` };
    if (d < 0) return { kind: 'down', text: `↓ ${Math.abs(d)}` };
    return { kind: 'same', text: 'gelijk' };
  }
  return dw > 0
    ? { kind: 'up', text: `↑ +${formatDecimal(dw)} kg` }
    : { kind: 'down', text: `↓ ${formatDecimal(Math.abs(dw))} kg` };
}

export interface DoneRow {
  /** Set index to open on tap. */
  index: number;
  label: string;
  delta: SetDelta;
  ariaLabel: string;
}

const SIDE_NAME = { left: 'links', right: 'rechts' } as const;

/**
 * The "Gedaan" list: one row per completed set, compared with the set at the
 * same position last time (`prevSets` in session order, per side for
 * unilateral exercises). A set without weight counts as 0 kg (bodyweight).
 */
export function doneRows(sets: WorkoutSet[], prevSets: PrevSetRef[]): DoneRow[] {
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

/**
 * Values the set card starts with for the opened set: a logged set shows its
 * own values; an open set gets the last logged set of this session (so the
 * next set after "Set klaar" carries the values over), else its own value or
 * plan, else the same set of the previous session. `null` = unknown.
 */
export function openSetValues(
  sets: WorkoutSet[],
  idx: number,
  prevSets: PrevSetRef[],
): { weight: number | null; reps: number | null } {
  const opened = sets[idx];
  if (opened?.completed) return { weight: opened.weight ?? 0, reps: opened.actualReps };
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

/** Button label of the ring (DESIGN §4): running = +30 sec, idle = start the rest. */
export function restRingLabel(seconds: number, running: boolean): string {
  return running
    ? `Rust, nog ${spokenDuration(seconds)}. Tik voor 30 seconden extra`
    : `Rust ${spokenDuration(seconds)}. Tik om de rust te starten`;
}

/** Label of the `role="timer"` element while resting: "Rust nog 1 minuut 12 seconden". */
export function restTimerLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `Rust nog ${m} ${m === 1 ? 'minuut' : 'minuten'} ${s % 60} seconden`;
}
