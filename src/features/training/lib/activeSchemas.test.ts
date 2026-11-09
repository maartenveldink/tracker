import { describe, it, expect } from 'vitest';
import { visibleSchemas, hasHiddenSchemas } from './activeSchemas';
import type { TrainingSchema } from '../../../db/index';

const mk = (id: string, active?: boolean) => ({ id, active }) as unknown as TrainingSchema;

describe('visibleSchemas', () => {
  it('shows everything when none is active (backwards compatible)', () => {
    const all = [mk('a'), mk('b', false)];
    expect(visibleSchemas(all)).toEqual(all);
    expect(hasHiddenSchemas(all)).toBe(false);
  });
  it('shows only active schemas, several allowed', () => {
    const all = [mk('a', true), mk('b'), mk('c', true)];
    expect(visibleSchemas(all).map(s => s.id)).toEqual(['a', 'c']);
    expect(hasHiddenSchemas(all)).toBe(true);
  });
  it('no hidden schemas when all are active, or list empty', () => {
    expect(hasHiddenSchemas([mk('a', true)])).toBe(false);
    expect(visibleSchemas([])).toEqual([]);
  });
});
