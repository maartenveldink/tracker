import { describe, expect, it } from 'vitest';
import { exerciseCardSummary, supersetLinkAction, toggleExpanded } from './exerciseEditCard';

describe('exerciseCardSummary', () => {
  it('shows sets × reps alone when no extras are given (suggested workout)', () => {
    expect(exerciseCardSummary({ sets: 3, repsPerSet: 8, repsMax: 12 })).toBe('3 × 8-12');
  });

  it('shows a fixed rep count without a valid upper bound', () => {
    expect(exerciseCardSummary({ sets: 4, repsPerSet: 10 })).toBe('4 × 10');
    expect(exerciseCardSummary({ sets: 4, repsPerSet: 10, repsMax: 10 })).toBe('4 × 10');
  });

  it('appends rest and start weight when given (schema editor)', () => {
    expect(
      exerciseCardSummary({ sets: 3, repsPerSet: 10 }, { restSeconds: 90, weight: 60 }),
    ).toBe('3 × 10 · rust 1:30 · 60 kg');
  });

  it('leaves out an unknown weight', () => {
    expect(exerciseCardSummary({ sets: 3, repsPerSet: 10 }, { restSeconds: 60, weight: null })).toBe(
      '3 × 10 · rust 1:00',
    );
  });
});

describe('supersetLinkAction', () => {
  const solo = { inSuperset: false, isFirst: true };

  it('offers nothing on the first exercise', () => {
    expect(supersetLinkAction(0, solo)).toBeNull();
  });

  it('offers linking when the exercise is not linked to the one above', () => {
    expect(supersetLinkAction(1, solo)).toBe('link');
    // First member of a later superset: not linked to the exercise above it.
    expect(supersetLinkAction(2, { inSuperset: true, isFirst: true })).toBe('link');
  });

  it('offers unlinking for a member linked to the one above', () => {
    expect(supersetLinkAction(1, { inSuperset: true, isFirst: false })).toBe('unlink');
  });

  it('copes with missing superset info', () => {
    expect(supersetLinkAction(1, undefined)).toBe('link');
  });
});

describe('toggleExpanded', () => {
  it('adds and removes a key without mutating the input', () => {
    const empty = new Set<string>();
    const open = toggleExpanded(empty, 'a');
    expect([...open]).toEqual(['a']);
    expect(empty.size).toBe(0);
    expect([...toggleExpanded(open, 'a')]).toEqual([]);
  });
});
