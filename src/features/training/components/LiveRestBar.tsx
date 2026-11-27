import { Minus, Plus } from 'lucide-react';
import { formatRestClock } from '../lib/setRegistration';
import { restBarCenterLabel } from '../lib/restBar';

interface LiveRestBarProps {
  /** Seconds shown: the remaining rest while resting, else the set rest duration. */
  seconds: number;
  /** A rest is running (the centre button then only closes the bar). */
  running: boolean;
  onAdjust: (dir: 1 | -1) => void;
  /** Tap on the time: close the bar (idle: and start the rest by hand). */
  onDone: () => void;
}

/**
 * DESIGN §4 "Rust-balk": replaces the rest ring + main button with one full-width
 * bar (64 high, radius 32, 2 px accent-2 border, surface): − | "Rust" + time | +.
 * Deliberately no "Set klaar" next to it.
 */
export function LiveRestBar({ seconds, running, onAdjust, onDone }: LiveRestBarProps) {
  const stepBtn =
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-line text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <div
      data-testid="rest-bar"
      className="flex h-button-train min-w-0 flex-1 items-center justify-between rounded-full border-2 border-accent-2 bg-surface px-2"
    >
      <button type="button" aria-label="Rust 15 seconden korter" className={stepBtn} onClick={() => onAdjust(-1)}>
        <Minus className="h-6 w-6" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={restBarCenterLabel(running)}
        onClick={onDone}
        className="flex h-12 items-center gap-2 rounded-full px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-[13px] font-medium text-muted">Rust</span>
        <span data-testid="rest-bar-time" className="font-display text-screen font-bold text-accent-2">
          {formatRestClock(seconds)}
        </span>
      </button>
      <button type="button" aria-label="Rust 15 seconden langer" className={stepBtn} onClick={() => onAdjust(1)}>
        <Plus className="h-6 w-6" aria-hidden="true" />
      </button>
    </div>
  );
}
