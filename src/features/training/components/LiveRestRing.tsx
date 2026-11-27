import { cn } from '@/lib/utils';
import { formatRestClock, restRingFraction, restRingIdleLabel, restRingIdleText, restRingLabel, restTimerLabel } from '../lib/setRegistration';

export interface RestTimerState {
  remaining: number; // seconds
  total: number;     // seconds
  startedAt: number; // Date.now() — uniquely identifies each timer start for effect deps
}

interface LiveRestRingProps {
  /** Running rest, or null when idle. */
  timer: RestTimerState | null;
  /** Rest that a manual start would use (shown muted while idle). */
  idleSeconds: number;
  /** The last rest just ran out: an idle ring shows 0:00 until the next start. */
  ended: boolean;
  /** Unilateral exercise (D1U): the idle ring shows "na R" (rest follows after the right part). */
  unilateral?: boolean;
  onExtend: () => void;
  onStart: () => void;
}

const R = 28;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * DESIGN §4 "Rust-ring": 64×64 next to the main button. Running: the ring runs
 * empty in accent-2, tap = +30 sec. Idle (no rest yet, or it ran out): an empty
 * ring with the rest duration in muted (unilateral, D1U: "na R"); tap starts
 * the rest by hand (§6 proposal).
 */
export function LiveRestRing({ timer, idleSeconds, ended, unilateral = false, onExtend, onStart }: LiveRestRingProps) {
  const running = timer !== null;
  const fraction = running ? restRingFraction(timer.remaining, timer.total) : 0;
  const shown = running ? formatRestClock(timer.remaining) : restRingIdleText(idleSeconds, ended, unilateral);

  const button = (
    <button
      type="button"
      aria-label={running ? restRingLabel(timer.remaining, true) : restRingIdleLabel(idleSeconds, unilateral)}
      onClick={running ? onExtend : onStart}
      className="relative h-button-train w-button-train shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={R} fill="none" strokeWidth="5" className="stroke-line" />
        {fraction > 0 && (
          <circle
            cx="32"
            cy="32"
            r={R}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            transform="rotate(-90 32 32)"
            className="stroke-accent-2 transition-[stroke-dasharray] duration-1000 ease-linear motion-reduce:transition-none"
          />
        )}
      </svg>
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-0 flex items-center justify-center font-display text-body-lg font-bold',
          running ? 'text-accent-2' : 'text-muted',
        )}
      >
        {shown}
      </span>
    </button>
  );

  // `rest-timer` / role="timer" only while resting (e2e + screen readers).
  return running ? (
    <div data-testid="rest-timer" role="timer" aria-label={restTimerLabel(timer.remaining)} className="shrink-0">
      {button}
    </div>
  ) : (
    <div data-testid="rest-ring-idle" className="shrink-0">
      {button}
    </div>
  );
}
