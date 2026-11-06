import { findUnknownExercises, formatPrescription, type SchemaJson, type SchemaJsonExercise } from './schemaJson';

/**
 * Compares a proposed schema (from the coach) with the current one, per day,
 * so the user sees what was added, changed, kept and dropped, with Claude's
 * `reason` per change and new library exercises flagged.
 *
 * Days are matched by name (case-insensitive); when both sides have exactly one
 * day/list they are paired regardless of name. Exercises are matched by name
 * within a day, in order (so a duplicated exercise pairs with its counterpart).
 * Exercises still unmatched afterwards are matched across days ("verplaatst"),
 * so turning a single-day schema into days doesn't read as drop-all + add-all.
 * A change of superset partners counts as a change; order changes do not.
 */

export type DiffRowKind = 'added' | 'changed' | 'unchanged' | 'moved';

export interface DiffRow {
  kind: DiffRowKind;
  exercise: SchemaJsonExercise;
  /** The matching exercise in the current schema (for changed/unchanged). */
  before?: SchemaJsonExercise;
  /** What changed, e.g. "3×8 → 4×8–12" or "nu superset met Face Pull" (changed/moved rows). */
  change?: string;
  /** Moved rows: the day it came from (null = the single-day list). */
  fromDay?: string | null;
  /** Not in the exercise library yet: saving creates it. */
  isNewExercise: boolean;
}

export interface DiffSection {
  /** Day name, or null for a single-day schema. */
  name: string | null;
  /** Day did not exist in the current schema. */
  isNewDay: boolean;
  /** Name of the paired current day when it differs (renamed). */
  previousName?: string | null;
  reason?: string;
  rows: DiffRow[];
  /** Exercises of the paired current day that are gone. */
  removed: SchemaJsonExercise[];
}

export interface SchemaDiff {
  sections: DiffSection[];
  /** Current days that have no counterpart in the proposal. */
  removedDays: { name: string | null; exercises: SchemaJsonExercise[]; movedCount: number }[];
  /** Distinct names that are not in the library (will be created). */
  newExercises: string[];
  counts: { added: number; changed: number; unchanged: number; removed: number; moved: number };
}

interface Section {
  name: string | null;
  exercises: SchemaJsonExercise[];
  reason?: string;
}

function sectionsOf(schema: SchemaJson | null): Section[] {
  if (!schema) return [];
  if (schema.days && schema.days.length > 0) {
    return schema.days.map(d => ({ name: d.name, exercises: d.exercises, ...(d.reason ? { reason: d.reason } : {}) }));
  }
  return [{ name: null, exercises: schema.exercises ?? [] }];
}

const key = (s: string | null) => (s ?? '').trim().toLowerCase();

function samePrescription(a: SchemaJsonExercise, b: SchemaJsonExercise): boolean {
  return (
    a.sets === b.sets &&
    a.reps === b.reps &&
    (a.repsMax ?? a.reps) === (b.repsMax ?? b.reps) &&
    (a.startWeight ?? null) === (b.startWeight ?? null) &&
    (a.restSeconds ?? null) === (b.restSeconds ?? null)
  );
}

/**
 * Per exercise of a list: the names of its superset partners (other members of
 * the same adjacent run sharing a label), sorted. Labels themselves are
 * arbitrary ("A" vs "1"), partners are what matters.
 */
function supersetPartners(list: SchemaJsonExercise[]): string[][] {
  const out: string[][] = list.map(() => []);
  for (let i = 0; i < list.length; ) {
    const g = list[i]!.supersetGroup;
    let j = i;
    if (g) while (j + 1 < list.length && list[j + 1]!.supersetGroup === g) j++;
    if (j > i) {
      for (let k = i; k <= j; k++) {
        out[k] = list
          .slice(i, j + 1)
          .filter((_, m) => m + i !== k)
          .map(e => e.exercise)
          .sort((a, b) => a.localeCompare(b));
      }
    }
    i = j + 1;
  }
  return out;
}

function describeChange(
  prev: SchemaJsonExercise,
  next: SchemaJsonExercise,
  prevPartners: string[],
  nextPartners: string[],
): string | undefined {
  const parts: string[] = [];
  if (!samePrescription(prev, next)) parts.push(`${formatPrescription(prev)} → ${formatPrescription(next)}`);
  if (prevPartners.map(key).join('|') !== nextPartners.map(key).join('|')) {
    parts.push(nextPartners.length > 0 ? `nu superset met ${nextPartners.join(', ')}` : 'geen superset meer');
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

interface Pending {
  exercise: SchemaJsonExercise;
  partners: string[];
  day: string | null;
  taken: boolean;
}

export function diffSchemas(
  current: SchemaJson | null,
  proposal: SchemaJson,
  libraryNames: Iterable<string>,
): SchemaDiff {
  const unknown = findUnknownExercises(proposal, libraryNames);
  const unknownKeys = new Set(unknown.map(n => n.trim().toLowerCase()));

  const before = sectionsOf(current);
  const after = sectionsOf(proposal);
  const used = new Set<number>();

  const pairFor = (s: Section, index: number): number => {
    const byName = before.findIndex((b, i) => !used.has(i) && key(b.name) === key(s.name));
    if (byName >= 0) return byName;
    if (before.length === 1 && after.length === 1 && index === 0 && !used.has(0)) return 0;
    return -1;
  };

  // Current exercises per section, with their superset partners; `taken` once matched.
  const pendingBySection: Pending[][] = before.map(b => {
    const partners = supersetPartners(b.exercises);
    return b.exercises.map((e, i) => ({ exercise: e, partners: partners[i]!, day: b.name, taken: false }));
  });

  const pairs = after.map((s, si) => {
    const pi = pairFor(s, si);
    if (pi >= 0) used.add(pi);
    return pi;
  });

  // Pass 1: match within the paired day. Pass 2: match leftovers across days.
  type Slot = { section: number; row: number; pending: Pending | null; moved: boolean };
  const slots: Slot[][] = after.map((s, si) =>
    s.exercises.map((e, ri) => {
      const pi = pairs[si]!;
      const pool = pi >= 0 ? pendingBySection[pi]! : [];
      const match = pool.find(p => !p.taken && key(p.exercise.exercise) === key(e.exercise)) ?? null;
      if (match) match.taken = true;
      return { section: si, row: ri, pending: match, moved: false };
    }),
  );
  const allPending = pendingBySection.flat();
  for (const sectionSlots of slots) {
    for (const slot of sectionSlots) {
      if (slot.pending) continue;
      const e = after[slot.section]!.exercises[slot.row]!;
      const match = allPending.find(p => !p.taken && key(p.exercise.exercise) === key(e.exercise));
      if (match) {
        match.taken = true;
        slot.pending = match;
        slot.moved = true;
      }
    }
  }

  const counts = { added: 0, changed: 0, unchanged: 0, removed: 0, moved: 0 };

  const sections: DiffSection[] = after.map((s, si) => {
    const pi = pairs[si]!;
    const old = pi >= 0 ? before[pi]! : null;
    const partners = supersetPartners(s.exercises);

    const rows: DiffRow[] = s.exercises.map((e, ri) => {
      const isNewExercise = unknownKeys.has(e.exercise.trim().toLowerCase());
      const slot = slots[si]![ri]!;
      if (!slot.pending) {
        counts.added++;
        return { kind: 'added', exercise: e, isNewExercise };
      }
      const prev = slot.pending.exercise;
      const change = describeChange(prev, e, slot.pending.partners, partners[ri]!);
      if (slot.moved) {
        counts.moved++;
        return {
          kind: 'moved',
          exercise: e,
          before: prev,
          fromDay: slot.pending.day,
          ...(change ? { change } : {}),
          isNewExercise,
        };
      }
      if (!change) {
        counts.unchanged++;
        return { kind: 'unchanged', exercise: e, before: prev, isNewExercise };
      }
      counts.changed++;
      return { kind: 'changed', exercise: e, before: prev, change, isNewExercise };
    });
    const removed = pi >= 0 ? pendingBySection[pi]!.filter(p => !p.taken).map(p => p.exercise) : [];
    counts.removed += removed.length;

    return {
      name: s.name,
      isNewDay: old === null && s.name !== null,
      ...(old && key(old.name) !== key(s.name) ? { previousName: old.name } : {}),
      ...(s.reason ? { reason: s.reason } : {}),
      rows,
      removed,
    };
  });

  // Unpaired current days: only what was not moved elsewhere is really dropped.
  const removedDays = before
    .map((b, i) => ({ b, i }))
    .filter(({ i }) => !used.has(i))
    .map(({ b, i }) => ({
      name: b.name,
      exercises: pendingBySection[i]!.filter(p => !p.taken).map(p => p.exercise),
      movedCount: pendingBySection[i]!.filter(p => p.taken).length,
    }));
  for (const d of removedDays) counts.removed += d.exercises.length;

  return { sections, removedDays, newExercises: unknown, counts };
}
