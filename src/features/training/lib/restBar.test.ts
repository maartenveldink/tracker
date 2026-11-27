import { describe, expect, it } from 'vitest';
import {
  REST_BAR_AUTO_CLOSE_MS,
  REST_STEP_SECONDS,
  adjustRestDuration,
  adjustRunningRest,
  restBarCenterLabel,
  restBarSeconds,
  sessionRestSeconds,
} from './restBar';

describe('rest bar constants', () => {
  it('steps 15 seconds and closes 3 seconds after the last adjustment', () => {
    expect(REST_STEP_SECONDS).toBe(15);
    expect(REST_BAR_AUTO_CLOSE_MS).toBe(3000);
  });
});

describe('adjustRestDuration', () => {
  it('adds or removes one step', () => {
    expect(adjustRestDuration(90, 1)).toBe(105);
    expect(adjustRestDuration(90, -1)).toBe(75);
  });
  it('never goes below 15 seconds', () => {
    expect(adjustRestDuration(15, -1)).toBe(15);
    expect(adjustRestDuration(20, -1)).toBe(15);
  });
  it('keeps the existing upper bound of 10 minutes', () => {
    expect(adjustRestDuration(600, 1)).toBe(600);
  });
});

describe('adjustRunningRest', () => {
  const timer = { remaining: 72, total: 90, startedAt: 1000 };
  it('changes the remaining and the total time by one step, keeping the start', () => {
    expect(adjustRunningRest(timer, 1)).toEqual({ remaining: 87, total: 105, startedAt: 1000 });
    expect(adjustRunningRest(timer, -1)).toEqual({ remaining: 57, total: 75, startedAt: 1000 });
  });
  it('lets the remaining time reach 0 (the rest then ends), never below', () => {
    expect(adjustRunningRest({ remaining: 10, total: 90, startedAt: 1000 }, -1)).toEqual({
      remaining: 0,
      total: 80,
      startedAt: 1000,
    });
  });
});

describe('restBarSeconds', () => {
  it('shows the remaining time while resting, else the set duration', () => {
    expect(restBarSeconds({ remaining: 42, total: 90, startedAt: 1 }, 90)).toBe(42);
    expect(restBarSeconds(null, 105)).toBe(105);
  });
});

describe('sessionRestSeconds', () => {
  it('uses the session override of this exercise, else the normal resolution', () => {
    expect(sessionRestSeconds({ a: 120 }, 'a', 90)).toBe(120);
    expect(sessionRestSeconds({ a: 120 }, 'b', 90)).toBe(90);
    expect(sessionRestSeconds({}, 'a', 90)).toBe(90);
  });
});

describe('restBarCenterLabel', () => {
  it('closes while resting, and also starts the rest by hand when idle', () => {
    expect(restBarCenterLabel(true)).toBe('Klaar met rust instellen');
    expect(restBarCenterLabel(false)).toBe('Klaar met rust instellen en rust starten');
  });
});
