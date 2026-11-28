/**
 * Supersets are adjacency-based: consecutive items sharing the same non-empty
 * `supersetGroup` form one superset (performed alternating, one set each).
 * These helpers work on any ordered list of `{ supersetGroup?: string }`, so
 * they apply to both `SchemaExercise[]` and `WorkoutExercise[]`.
 */

interface Groupable {
  supersetGroup?: string;
}

/** Letter label for a position within a superset (0 → "A", 1 → "B", …). */
export function supersetLabel(position: number): string {
  return String.fromCharCode(65 + position);
}

export interface SupersetInfo {
  /** True when this item belongs to a superset (a run of ≥2 adjacent members). */
  inSuperset: boolean;
  /** The group id, or undefined when not in a superset. */
  groupId: string | undefined;
  /** Indices (into the original list) of all members of this run, in order. */
  members: number[];
  /** This item's position within the run (0-based). */
  position: number;
  /** Convenience label ("A", "B", …) for the position. */
  label: string;
  isFirst: boolean;
  isLast: boolean;
}

/**
 * Returns per-index superset info. Only runs of ≥2 adjacent items with the same
 * group id count as a superset; lone/singleton groups are treated as ungrouped.
 */
export function groupSupersets(items: Groupable[]): SupersetInfo[] {
  const result: SupersetInfo[] = new Array(items.length);

  let i = 0;
  while (i < items.length) {
    const group = items[i]?.supersetGroup;
    // Extend a run of identical, non-empty group ids.
    let j = i;
    if (group) {
      while (j + 1 < items.length && items[j + 1]?.supersetGroup === group) j++;
    }
    const runLength = j - i + 1;
    const members = Array.from({ length: runLength }, (_, k) => i + k);
    const isRealSuperset = Boolean(group) && runLength >= 2;

    for (let k = 0; k < runLength; k++) {
      const idx = i + k;
      result[idx] = isRealSuperset
        ? {
            inSuperset: true,
            groupId: group,
            members,
            position: k,
            label: supersetLabel(k),
            isFirst: k === 0,
            isLast: k === runLength - 1,
          }
        : {
            inSuperset: false,
            groupId: undefined,
            members: [idx],
            position: 0,
            label: supersetLabel(0),
            isFirst: true,
            isLast: true,
          };
    }
    i = j + 1;
  }

  return result;
}

/**
 * Splits the list into consecutive blocks: each block is either a single index
 * or the ordered member indices of one superset run. Useful for rendering a
 * shared wrapper around superset members.
 */
export function supersetBlocks(items: Groupable[]): number[][] {
  const infos = groupSupersets(items);
  const blocks: number[][] = [];
  for (let i = 0; i < items.length; ) {
    const info = infos[i]!;
    if (info.inSuperset) {
      blocks.push(info.members);
      i = info.members[info.members.length - 1]! + 1;
    } else {
      blocks.push([i]);
      i++;
    }
  }
  return blocks;
}

/**
 * Clears group ids that aren't shared with an adjacent item (singletons left
 * behind after a move/remove). Returns a new array; unchanged items keep their
 * reference where possible.
 */
export function normalizeSupersets<T extends Groupable>(items: T[]): T[] {
  return items.map((item, idx) => {
    const group = item.supersetGroup;
    if (!group) return item;
    const prevSame = items[idx - 1]?.supersetGroup === group;
    const nextSame = items[idx + 1]?.supersetGroup === group;
    if (prevSame || nextSame) return item;
    // Singleton — strip the group.
    const { supersetGroup: _drop, ...rest } = item;
    return rest as T;
  });
}

/** True when item `index` is linked (same superset run) with the item above it. */
export function isLinkedToPrevious(items: Groupable[], index: number): boolean {
  const info = groupSupersets(items)[index];
  return !!info && info.inSuperset && !info.isFirst;
}

/**
 * Links item `index` with the item above it (`link`), or unlinks it. Linking
 * joins the group above (a pair becomes a group of three) and pulls along the
 * run that `index` starts, if any. Unlinking splits the run at `index`: the
 * members from `index` on keep a group of their own under `newGroupId` (a lone
 * member loses its id). Only `supersetGroup` changes; a no-op returns `items`.
 */
export function setSupersetLink<T extends Groupable>(
  items: T[],
  index: number,
  link: boolean,
  newGroupId: string,
): T[] {
  if (index <= 0 || index >= items.length) return items;
  if (isLinkedToPrevious(items, index) === link) return items;
  const infos = groupSupersets(items);
  const own = infos[index]!.members;
  let next: T[];
  if (link) {
    const group = (infos[index - 1]!.inSuperset ? items[index - 1]!.supersetGroup : undefined) ?? newGroupId;
    const members = new Set([index - 1, ...own]);
    next = items.map((it, i) => (members.has(i) ? { ...it, supersetGroup: group } : it));
  } else {
    const below = new Set(own.filter(m => m >= index));
    next = items.map((it, i) => (below.has(i) ? { ...it, supersetGroup: newGroupId } : it));
  }
  return normalizeSupersets(next);
}

interface LinkableExercise extends Groupable {
  sets: { completed: boolean; skipped?: boolean }[];
}

/**
 * Live workout rule: item `index` may be linked with the one above only when
 * every member of the resulting superset is untouched (no set logged or
 * skipped), so the round mapping never reinterprets logged sets and a skipped
 * exercise is never pulled into a superset.
 */
export function canLinkWithPrevious(items: LinkableExercise[], index: number): boolean {
  if (index <= 0 || index >= items.length || isLinkedToPrevious(items, index)) return false;
  const infos = groupSupersets(items);
  const members = [...infos[index - 1]!.members, ...infos[index]!.members];
  return members.every(m => items[m]!.sets.every(s => !s.completed && !s.skipped));
}
