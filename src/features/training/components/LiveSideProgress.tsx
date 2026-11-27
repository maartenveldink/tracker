import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { zigzagLayout, type SideDot } from '../lib/setRegistration';
import { LiveSetRowScroller } from './LiveSetRowScroller';

interface LiveSideProgressProps {
  dots: SideDot[];
  onOpen: (setIndex: number) => void;
  onAdd: () => void;
}

/** Room above and below the 62 px track so the 44 px tap targets are not clipped by the scroller. */
const PAD_Y = 6;

/**
 * DESIGN §4 "Set-voortgang, unilateraal" (`TrainingD1U.dc.html`) on the
 * "Schuifbare set-rij": one dot per part, left on the top row and right on the
 * bottom row, in zigzag order L1 → R1 → L2 → R2 with a line from centre to
 * centre, and the plus dot always last on the top row. There is no side switch:
 * the row of the opened dot shows the side (the L/R labels at the start scroll
 * along). Dots are 28 px with a 44 × 44 tap target centred on them; the step is
 * a fixed 46 px, so a wider row scrolls (see `LiveSetRowScroller`).
 */
export function LiveSideProgress({ dots, onOpen, onAdd }: LiveSideProgressProps) {
  const layout = zigzagLayout(dots.length);
  const opened = dots.findIndex((d) => d.pressed);
  const hit =
    'absolute flex h-touch w-touch -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const dot = 'box-border flex h-7 w-7 items-center justify-center rounded-full text-body font-bold';
  const plus = layout.points[dots.length]!;
  const y = (v: number) => v + PAD_Y;

  return (
    <div role="group" aria-label="Sets, links en rechts">
      <LiveSetRowScroller
        openedKey={opened}
        count={dots.length}
        // Design margin top 10 (and 0 below) minus the extra room around the track.
        className="-mb-1.5 mt-1"
        contentClassName="relative"
        // border-box: the width includes the 22 px right padding.
        contentStyle={{ width: layout.width + 22, height: 62 + 2 * PAD_Y }}
      >
        <span aria-hidden="true" className="absolute left-0 text-small font-semibold text-muted" style={{ top: y(9) }}>L</span>
        <span aria-hidden="true" className="absolute left-0 text-small font-semibold text-muted" style={{ top: y(39) }}>R</span>
        {layout.lines.map((l, k) => (
          <span
            key={`line-${k}`}
            aria-hidden="true"
            className={cn('absolute h-0.5 origin-left', k < dots.length && dots[k]!.lineOn ? 'bg-accent' : 'bg-line')}
            style={{ left: l.x, top: y(l.y) - 1, width: l.length, transform: `rotate(${l.angle}deg)` }}
          />
        ))}
        {dots.map((d, k) => {
          const p = layout.points[k]!;
          return (
            <button
              key={d.index}
              type="button"
              data-testid="side-dot"
              data-side={d.side}
              data-set={d.number}
              data-state={d.state}
              aria-label={d.ariaLabel}
              aria-pressed={d.pressed}
              onClick={() => onOpen(d.index)}
              className={hit}
              style={{ left: p.x, top: y(p.y) }}
            >
              <span
                className={cn(
                  dot,
                  // The opened dot has a bg fill so it covers the line behind it.
                  d.state === 'open' && 'border-2 border-accent bg-bg text-accent',
                  d.state === 'done' && 'bg-accent text-on-accent',
                  d.state === 'todo' && 'bg-line text-muted',
                )}
              >
                {d.number}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Set toevoegen"
          onClick={onAdd}
          className={hit}
          style={{ left: plus.x, top: y(plus.y) }}
        >
          <span className={cn(dot, 'border-[1.5px] border-dashed border-line-strong bg-bg text-accent')}>
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          </span>
        </button>
      </LiveSetRowScroller>
    </div>
  );
}
