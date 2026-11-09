import { describe, it, expect } from 'vitest';
import { scheduleLabel } from './schedule';

describe('scheduleLabel', () => {
  it('describes each schedule kind in Dutch', () => {
    expect(scheduleLabel({ kind: 'daily' })).toBe('Elke dag');
    expect(scheduleLabel({ kind: 'interval', everyDays: 1, anchor: '2025-01-01' })).toBe('Elke dag');
    expect(scheduleLabel({ kind: 'interval', everyDays: 3, anchor: '2025-01-01' })).toBe('Elke 3 dagen');
    expect(scheduleLabel({ kind: 'weekdays', days: [0, 2, 4] })).toBe('ma, wo, vr');
    expect(scheduleLabel({ kind: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] })).toBe('Elke dag');
    expect(scheduleLabel({ kind: 'monthdays', days: [1, 15] })).toBe('Dag 1, 15 van de maand');
  });
});
