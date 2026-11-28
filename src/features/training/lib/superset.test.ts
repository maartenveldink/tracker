import { describe, expect, it } from 'vitest';
import { canLinkWithPrevious, groupSupersets, isLinkedToPrevious, setSupersetLink } from './superset';

type Item = { name: string; supersetGroup?: string; sets: { completed: boolean; skipped?: boolean }[] };

const fresh = (name: string, supersetGroup?: string): Item => ({
  name,
  ...(supersetGroup ? { supersetGroup } : {}),
  sets: [{ completed: false }, { completed: false }],
});
const started = (name: string, supersetGroup?: string): Item => ({
  ...fresh(name, supersetGroup),
  sets: [{ completed: true }, { completed: false }],
});
const skipped = (name: string): Item => ({ name, sets: [{ completed: false, skipped: true }] });

/** Superset runs as names, e.g. [["A","B"],["C"]]. */
function runs(items: Item[]): string[][] {
  const infos = groupSupersets(items);
  const out: string[][] = [];
  items.forEach((it, i) => {
    if (infos[i]!.isFirst) out.push([]);
    out[out.length - 1]!.push(it.name);
  });
  return out;
}

describe('isLinkedToPrevious', () => {
  it('is true only for a non-first member of a real superset', () => {
    const items = [fresh('A', 'g'), fresh('B', 'g'), fresh('C')];
    expect(items.map((_, i) => isLinkedToPrevious(items, i))).toEqual([false, true, false]);
  });

  it('ignores a lone group id', () => {
    const items = [fresh('A'), fresh('B', 'g')];
    expect(isLinkedToPrevious(items, 1)).toBe(false);
  });
});

describe('setSupersetLink', () => {
  it('links two loose exercises with a new group id', () => {
    const next = setSupersetLink([fresh('A'), fresh('B'), fresh('C')], 1, true, 'new');
    expect(runs(next)).toEqual([['A', 'B'], ['C']]);
    expect(next[0]!.supersetGroup).toBe('new');
    expect(next[1]!.supersetGroup).toBe('new');
    expect(next[2]!.supersetGroup).toBeUndefined();
  });

  it('joins the group above, making a group of three', () => {
    const next = setSupersetLink([fresh('A', 'g'), fresh('B', 'g'), fresh('C')], 2, true, 'new');
    expect(runs(next)).toEqual([['A', 'B', 'C']]);
    expect(next.every(e => e.supersetGroup === 'g')).toBe(true);
  });

  it('pulls the whole run below along when that exercise starts a superset', () => {
    const next = setSupersetLink([fresh('A'), fresh('B', 'h'), fresh('C', 'h')], 1, true, 'new');
    expect(runs(next)).toEqual([['A', 'B', 'C']]);
  });

  it('unlinking the second of a pair dissolves the pair (no lone group ids left)', () => {
    const next = setSupersetLink([fresh('A', 'g'), fresh('B', 'g')], 1, false, 'new');
    expect(runs(next)).toEqual([['A'], ['B']]);
    expect(next.every(e => e.supersetGroup === undefined)).toBe(true);
  });

  it('unlinking in a group of three splits it there and keeps the part below together', () => {
    const next = setSupersetLink([fresh('A', 'g'), fresh('B', 'g'), fresh('C', 'g')], 1, false, 'new');
    expect(runs(next)).toEqual([['A'], ['B', 'C']]);
    expect(next[1]!.supersetGroup).toBe('new');
  });

  it('unlinking the last of three keeps the first two linked', () => {
    const next = setSupersetLink([fresh('A', 'g'), fresh('B', 'g'), fresh('C', 'g')], 2, false, 'new');
    expect(runs(next)).toEqual([['A', 'B'], ['C']]);
  });

  it('leaves sets and other fields untouched', () => {
    const items = [started('A'), fresh('B')];
    const next = setSupersetLink(items, 1, true, 'new');
    expect(next[0]!.sets).toBe(items[0]!.sets);
    expect(next[1]!.name).toBe('B');
  });

  it('is a no-op for the first exercise, an out-of-range index or a state already reached', () => {
    const items = [fresh('A', 'g'), fresh('B', 'g'), fresh('C')];
    expect(setSupersetLink(items, 0, true, 'new')).toBe(items);
    expect(setSupersetLink(items, 5, true, 'new')).toBe(items);
    expect(setSupersetLink(items, 1, true, 'new')).toBe(items);
    expect(setSupersetLink(items, 2, false, 'new')).toBe(items);
  });
});

describe('canLinkWithPrevious', () => {
  it('allows two untouched exercises', () => {
    expect(canLinkWithPrevious([fresh('A'), fresh('B')], 1)).toBe(true);
  });

  it('never allows the first exercise or one that is already linked', () => {
    expect(canLinkWithPrevious([fresh('A'), fresh('B')], 0)).toBe(false);
    expect(canLinkWithPrevious([fresh('A', 'g'), fresh('B', 'g')], 1)).toBe(false);
  });

  it('refuses when either exercise has a logged set', () => {
    expect(canLinkWithPrevious([started('A'), fresh('B')], 1)).toBe(false);
    expect(canLinkWithPrevious([fresh('A'), started('B')], 1)).toBe(false);
  });

  it('refuses a skipped exercise', () => {
    expect(canLinkWithPrevious([skipped('A'), fresh('B')], 1)).toBe(false);
    expect(canLinkWithPrevious([fresh('A'), skipped('B')], 1)).toBe(false);
  });

  it('checks every member of the resulting group (group of three)', () => {
    expect(canLinkWithPrevious([fresh('A', 'g'), fresh('B', 'g'), fresh('C')], 2)).toBe(true);
    expect(canLinkWithPrevious([started('A', 'g'), fresh('B', 'g'), fresh('C')], 2)).toBe(false);
    expect(canLinkWithPrevious([fresh('A'), fresh('B', 'h'), started('C', 'h')], 1)).toBe(false);
  });

  it('allows an exercise without sets', () => {
    expect(canLinkWithPrevious([fresh('A'), { name: 'B', sets: [] }], 1)).toBe(true);
  });
});
