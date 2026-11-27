import { describe, expect, it } from 'vitest';
import { SET_ROW_FADE_NONE, scrollEdges, setRowFadeMask } from './setRow';

describe('scrollEdges (rtl scroller: scrollLeft 0 = right edge, negative to the left)', () => {
  it('no fade when the row fits', () => {
    expect(scrollEdges({ scrollLeft: 0, scrollWidth: 350, clientWidth: 350 })).toEqual({ left: false, right: false });
    // sub-pixel rounding is not an overflow
    expect(scrollEdges({ scrollLeft: 0, scrollWidth: 350.6, clientWidth: 350 })).toEqual({ left: false, right: false });
  });
  it('at the start (right-aligned): only sets hidden on the left', () => {
    expect(scrollEdges({ scrollLeft: 0, scrollWidth: 600, clientWidth: 350 })).toEqual({ left: true, right: false });
  });
  it('scrolled all the way left: only content hidden on the right', () => {
    expect(scrollEdges({ scrollLeft: -250, scrollWidth: 600, clientWidth: 350 })).toEqual({ left: false, right: true });
    expect(scrollEdges({ scrollLeft: -249.5, scrollWidth: 600, clientWidth: 350 })).toEqual({ left: false, right: true });
  });
  it('in the middle: both edges', () => {
    expect(scrollEdges({ scrollLeft: -100, scrollWidth: 600, clientWidth: 350 })).toEqual({ left: true, right: true });
  });
  it('an old positive rtl convention (scrollLeft = max at the right) also works', () => {
    expect(scrollEdges({ scrollLeft: 250, scrollWidth: 600, clientWidth: 350 })).toEqual({ left: true, right: false });
  });
});

describe('setRowFadeMask', () => {
  it('both edges: the design gradient', () => {
    expect(setRowFadeMask({ left: true, right: true })).toBe(
      'linear-gradient(to right, transparent 0, transparent 4px, #000 76px, #000 calc(100% - 22px), transparent 100%)',
    );
  });
  it('one edge: only that side fades', () => {
    expect(setRowFadeMask({ left: true, right: false })).toBe(
      'linear-gradient(to right, transparent 0, transparent 4px, #000 76px, #000 100%)',
    );
    expect(setRowFadeMask({ left: false, right: true })).toBe(
      'linear-gradient(to right, #000 0, #000 calc(100% - 22px), transparent 100%)',
    );
  });
  it('no edge: no mask', () => {
    expect(setRowFadeMask({ left: false, right: false })).toBe(SET_ROW_FADE_NONE);
  });
});
