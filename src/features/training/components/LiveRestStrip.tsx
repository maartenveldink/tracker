import { RotateCcw } from 'lucide-react';

export interface RestTimerState {
  remaining: number; // seconds
  total: number;     // seconds
  startedAt: number; // Date.now() — uniquely identifies each timer start for effect deps
}

interface LiveRestStripProps {
  timer: RestTimerState;
  onExtend: () => void;
  onReset: () => void;
  onSkip: () => void;
}

/** DESIGN §4 "Rusttimer-strook": rest, time in accent-2, "+30 sec", 4px progress bar. */
export function LiveRestStrip({ timer, onExtend, onReset, onSkip }: LiveRestStripProps) {
  const progress = timer.total > 0 ? (timer.remaining / timer.total) * 100 : 0;
  const minutes = Math.floor(timer.remaining / 60);
  const seconds = timer.remaining % 60;
  const textBtn =
    'flex h-touch items-center justify-center rounded-chip px-3 text-small font-semibold text-text hover:bg-line/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div
      data-testid="rest-timer"
      className="flex flex-col gap-2 rounded-row border border-line bg-surface px-3.5 py-2.5"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-small text-muted">Rust</span>
        <span
          role="timer"
          aria-label={`Rust nog ${minutes} minuten ${seconds} seconden`}
          className="font-display text-title font-bold text-accent-2"
        >
          {minutes}:{String(seconds).padStart(2, '0')}
        </span>
        <div className="flex items-center">
          <button type="button" className={textBtn} onClick={onExtend}>
            +30 sec
          </button>
          <button type="button" aria-label="Rust opnieuw starten" className={textBtn} onClick={onReset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={textBtn} onClick={onSkip}>
            Sla over
          </button>
        </div>
      </div>
      <div className="h-1 rounded-sm bg-line">
        <div
          className="h-1 rounded-sm bg-accent-2 transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
