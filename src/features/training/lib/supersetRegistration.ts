import type { WorkoutExercise, WorkoutSet } from '../../../db/index';
import { appendSet, formatDecimal, type PrevSetRef } from './liveTraining';
import type { SupersetInfo } from './superset';
import { isUnilateral, type DeltaKind, type DotState, type DoneRow, type SetDelta } from './setRegistration';

/**
 * Pure logic of the E2 superset set registration (`TrainingE2.dc.html`, DESIGN
 * §4 "Set-voortgang, superset", §6 "Supersets"). Only a superset of exactly two
 * exercises gets this view (A = first member, B = second); groups of three or
 * more and pairs with a unilateral member keep the B1/D1U view per member.
 *
 * The data model is unchanged: each member keeps its own set list. Round i is
 * set i of A + set i of B. The number of rounds is the longest set list; a
 * member with fewer sets has an *empty slot* in the later rounds (no dot, no
 * line, never "open" or "done").
 *
 * A part is one dot of the zigzag A1 → B1 → A2 → B2 …; its slot is
 * `2 × round + member` (member 0 = A on the top row, 1 = B on the bottom row).
 */

export type Member = 0 | 1;

export interface PartRef {
  member: Member;
  /** Set index into that member's `sets` (= the 0-based round). */
  setIdx: number;
}

const settled = (s: WorkoutSet) => s.completed || s.skipped;
const PART_LETTER = ['A', 'B'] as const;

/**
 * The E2 view applies: a superset of exactly two members, neither logged per
 * side (superset + unilateral is not designed and keeps the existing view).
 */
export function isSupersetPair(info: SupersetInfo | undefined, exercises: WorkoutExercise[]): boolean {
  if (!info?.inSuperset || info.members.length !== 2) return false;
  return info.members.every(m => !isUnilateral(exercises[m]?.sets ?? []));
}

/** Rounds of a pair: the longest of the two set lists. */
export function roundCount(a: WorkoutSet[], b: WorkoutSet[]): number {
  return Math.max(a.length, b.length);
}

/**
 * The default opened part (`sel` = null): the first part in zigzag order that
 * is neither logged nor skipped, or null when every part is settled.
 */
export function firstOpenPart(a: WorkoutSet[], b: WorkoutSet[]): PartRef | null {
  const lists = [a, b];
  for (let r = 0; r < roundCount(a, b); r++) {
    for (const member of [0, 1] as const) {
      const s = lists[member]![r];
      if (s && !settled(s)) return { member, setIdx: r };
    }
  }
  return null;
}

/** Whether the round of a part has a B part (else it is A's alone: rest follows right after A). */
export function roundHasB(b: WorkoutSet[], setIdx: number): boolean {
  return setIdx >= 0 && setIdx < b.length;
}

export interface SupersetDot extends PartRef {
  /** Position in the zigzag: `2 × round + member`. */
  slot: number;
  /** Round number shown in the dot (1-based). */
  number: number;
  part: 'A' | 'B';
  state: DotState;
  /** The line leaving this part (towards the next dot) is accent: this part is done. */
  lineOn: boolean;
  pressed: boolean;
  ariaLabel: string;
}

/** The zigzag dots of a pair in order A1, B1, A2, B2 …, skipping empty slots. */
export function supersetDots(a: WorkoutSet[], b: WorkoutSet[], opened: PartRef | null): SupersetDot[] {
  const lists = [a, b];
  const dots: SupersetDot[] = [];
  for (let r = 0; r < roundCount(a, b); r++) {
    for (const member of [0, 1] as const) {
      const s = lists[member]![r];
      if (!s) continue;
      const isOpen = !!opened && opened.member === member && opened.setIdx === r;
      const part = PART_LETTER[member];
      const status = s.completed ? ' (klaar), aanpassen' : s.skipped ? ' (overgeslagen)' : '';
      dots.push({
        member,
        setIdx: r,
        slot: 2 * r + member,
        number: r + 1,
        part,
        state: isOpen ? 'open' : s.completed ? 'done' : 'todo',
        lineOn: s.completed,
        pressed: isOpen,
        ariaLabel: `Set ${r + 1} van ${part}${status}`,
      });
    }
  }
  return dots;
}

/** Round away float noise (0.1 + 0.2) before comparing weights. */
const kg = (n: number) => Math.round(n * 100) / 100;

/**
 * Difference of a round with the same round last time (DESIGN §6 "Supersets"):
 * no weight differs → the reps differences of A and B summed (`↑ +3`, `gelijk`,
 * `↓ 1`); a weight differs → the kg differences of the differing parts summed;
 * a performed part without its previous counterpart → `nieuw`. `undefined`
 * parts (empty slot or skipped) are left out.
 */
export function roundDelta(
  cur: (PrevSetRef | undefined)[],
  prev: (PrevSetRef | undefined)[],
): SetDelta {
  const pairs = cur.flatMap((c, i) => (c ? [{ c, p: prev[i] }] : []));
  if (pairs.length === 0 || pairs.some(x => !x.p)) return { kind: 'new', text: 'nieuw' };
  const diffs = pairs.map(({ c, p }) => ({ dw: kg(c.weight - p!.weight), dr: c.reps - p!.reps }));
  const anyKg = diffs.some(d => d.dw !== 0);
  const d = anyKg ? kg(diffs.reduce((sum, x) => sum + x.dw, 0)) : diffs.reduce((sum, x) => sum + x.dr, 0);
  const kind: DeltaKind = d > 0 ? 'up' : d < 0 ? 'down' : 'same';
  if (kind === 'same') return { kind, text: 'gelijk' };
  const amount = anyKg ? `${formatDecimal(Math.abs(d))} kg` : String(Math.abs(d));
  return { kind, text: kind === 'up' ? `↑ +${amount}` : `↓ ${amount}` };
}

export interface RoundRow extends DoneRow {
  /** The part a tap opens: A of that round, else B (A has an empty slot or was skipped). */
  open: PartRef;
}

/**
 * The superset Gedaan list: one row per round that is finished (no existing
 * part still open, at least one logged), `Set 3 · 140 × 8 · 45 × 12`. A part
 * without a logged set (empty slot or skipped) shows as `—`. Compared with the
 * same round last time (`prevA`/`prevB`: the performed sets of the previous
 * session of each exercise, in order). A set without weight counts as 0 kg.
 */
export function supersetDoneRows(
  a: WorkoutSet[],
  b: WorkoutSet[],
  prevA: PrevSetRef[],
  prevB: PrevSetRef[],
): RoundRow[] {
  const rows: RoundRow[] = [];
  for (let r = 0; r < roundCount(a, b); r++) {
    const parts = [a[r], b[r]];
    if (parts.some(s => s && !settled(s)) || !parts.some(s => s?.completed)) continue;
    const refs = parts.map(s => (s?.completed ? { weight: s.weight ?? 0, reps: s.actualReps ?? 0 } : undefined));
    const label = [`Set ${r + 1}`, ...refs.map(x => (x ? `${formatDecimal(x.weight)} × ${x.reps}` : '—'))].join(' · ');
    const delta = roundDelta(refs, [prevA[r], prevB[r]]);
    rows.push({
      index: r,
      label,
      delta,
      // Visible text first (label-in-name), then the action as in the design.
      ariaLabel: `${label}, ${delta.text}, aanpassen`,
      open: { member: refs[0] ? 0 : 1, setIdx: r },
    });
  }
  return rows;
}

/**
 * The plus dot of a pair adds a round: both members are filled up to one round
 * more than now (normally one set each; a member with empty slots gets those
 * filled too, so the new round really has an A and a B part). Each new set
 * takes the values of that member's last set; existing sets never change.
 */
export function appendRound(a: WorkoutSet[], b: WorkoutSet[], ids: [string, string]): [WorkoutSet[], WorkoutSet[]] {
  const target = roundCount(a, b) + 1;
  const fill = (sets: WorkoutSet[], id: string) => {
    let next = sets;
    while (next.length < target) next = appendSet(next, id);
    return next;
  };
  return [fill(a, ids[0]), fill(b, ids[1])];
}
