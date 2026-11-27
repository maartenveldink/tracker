import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SetDot } from '../lib/setRegistration';

interface LiveSetProgressProps {
  dots: SetDot[];
  canAdd: boolean;
  onOpen: (setIndex: number) => void;
  onAdd: () => void;
}

/**
 * DESIGN §4 "Set-voortgang": a dot per set with lines in between and a plus
 * dot at the end (hidden at the maximum). Tap a dot to open that set.
 * Hit areas are 48 high; with many sets on a narrow screen they may shrink
 * in width down to the 36px dot so the row never overflows.
 */
export function LiveSetProgress({ dots, canAdd, onOpen, onAdd }: LiveSetProgressProps) {
  const hit =
    'flex h-12 w-12 min-w-9 shrink items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const dot = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-body font-bold';
  const line = (on: boolean) => <span aria-hidden="true" className={cn('h-0.5 min-w-1.5 flex-1', on ? 'bg-accent' : 'bg-line')} />;

  return (
    <div className="flex items-center" role="group" aria-label="Sets">
      {dots.map((d, i) => (
        <span key={d.number} className="contents">
          {i > 0 && line(d.lineOn)}
          <button
            type="button"
            data-testid="set-row"
            data-state={d.state}
            aria-label={d.ariaLabel}
            aria-pressed={d.pressed}
            onClick={() => onOpen(d.target)}
            className={hit}
          >
            <span
              className={cn(
                dot,
                d.state === 'open' && 'border-2 border-accent text-accent',
                d.state === 'done' && 'bg-accent text-on-accent',
                d.state === 'todo' && 'bg-line text-muted',
              )}
            >
              {d.number}
            </span>
          </button>
        </span>
      ))}
      {canAdd && (
        <>
          {dots.length > 0 && line(false)}
          <button type="button" aria-label="Set toevoegen" onClick={onAdd} className={hit}>
            <span className={cn(dot, 'border-[1.5px] border-dashed border-line-strong text-accent')}>
              <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            </span>
          </button>
        </>
      )}
    </div>
  );
}
