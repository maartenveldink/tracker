/**
 * Schuifbare set-rij (DESIGN §4, §12 q15/q16): which edges of the horizontally
 * scrolling set row hide content, and the fade mask for those edges.
 *
 * The scroller has `direction: rtl` so it starts right-aligned (last sets and
 * the plus dot in view). In current browsers (CSSOM spec) `scrollLeft` is then
 * 0 at the right edge and negative towards the left; an old engine that counts
 * positive from the left edge is handled too (0 is read as the start, which is
 * the right edge in the spec convention).
 */

export interface ScrollMetrics {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

export interface ScrollEdges {
  /** Sets are hidden beyond the left edge. */
  left: boolean;
  /** Content is hidden beyond the right edge. */
  right: boolean;
}

/** Sub-pixel slack: rounding of scroll positions and widths is not an overflow. */
const SLACK = 1;

export function scrollEdges({ scrollLeft, scrollWidth, clientWidth }: ScrollMetrics): ScrollEdges {
  const max = scrollWidth - clientWidth;
  if (max <= SLACK) return { left: false, right: false };
  // Distance of the viewport from the far left of the content.
  const fromLeft = scrollLeft <= 0 ? max + scrollLeft : scrollLeft;
  return { left: fromLeft > SLACK, right: max - fromLeft > SLACK };
}

export const SET_ROW_FADE_NONE = 'none';

/**
 * The design gradient (`transparent 0, transparent 4px, #000 76px,
 * #000 calc(100% - 22px), transparent 100%`), split per edge so only an edge
 * that hides something fades. The only gradient allowed in the app (§1).
 */
export function setRowFadeMask(edges: ScrollEdges): string {
  if (!edges.left && !edges.right) return SET_ROW_FADE_NONE;
  const left = edges.left ? 'transparent 0, transparent 4px, #000 76px' : '#000 0';
  const right = edges.right ? '#000 calc(100% - 22px), transparent 100%' : '#000 100%';
  return `linear-gradient(to right, ${left}, ${right})`;
}
