import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SetDot } from '../lib/setRegistration';
import { LiveSetRowScroller } from './LiveSetRowScroller';

interface LiveSetProgressProps {
  dots: SetDot[];
  onOpen: (setIndex: number) => void;
  onAdd: () => void;
}

/**
 * DESIGN §4 "Set-voortgang" + "Schuifbare set-rij" (`TrainingE1.dc.html`): a
 * dot per set with lines in between and the plus dot always last. Tap a dot to
 * open that set. Fixed spacing (48 px button + 12 px line, never shrinking);
 * a wider row scrolls horizontally, starting right-aligned (see
 * `LiveSetRowScroller`). There is no maximum number of sets.
 */
export function LiveSetProgress({ dots, onOpen, onAdd }: LiveSetProgressProps) {
  const openedIndex = dots.findIndex((d) => d.pressed);
  // Inset ring: the scroller clips anything outside the 48 px button.
  const hit =
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';
  const dot = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-body font-bold';
  const line = (on: boolean) => <span aria-hidden="true" className={cn('h-0.5 w-3 shrink-0', on ? 'bg-accent' : 'bg-line')} />;

  return (
    <div role="group" aria-label="Sets">
      <LiveSetRowScroller openedKey={openedIndex} count={dots.length} contentClassName="flex items-center">
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
        {dots.length > 0 && line(false)}
        <button type="button" aria-label="Set toevoegen" onClick={onAdd} className={hit}>
          <span className={cn(dot, 'border-[1.5px] border-dashed border-line-strong text-accent')}>
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          </span>
        </button>
      </LiveSetRowScroller>
    </div>
  );
}
