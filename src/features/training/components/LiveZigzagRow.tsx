import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { zigzagTrack, type DotState } from '../lib/setRegistration';
import { LiveSetRowScroller } from './LiveSetRowScroller';

export interface ZigzagDot {
  key: string | number;
  /** Zigzag slot: even = top row, odd = bottom row (`2 × set + row`). */
  slot: number;
  number: number;
  state: DotState;
  /** The line leaving this dot (towards the next one) is accent. */
  lineOn: boolean;
  pressed: boolean;
  ariaLabel: string;
  /** Test id + data attributes of the dot button (e2e hooks). */
  testId: string;
  data: Record<`data-${string}`, string | number>;
  onClick: () => void;
}

interface LiveZigzagRowProps {
  /** Accessible name of the group ("Sets, links en rechts"). */
  label: string;
  /** Row labels in the gutter: [top, bottom] ("L"/"R" or "A"/"B"); aria-hidden, they scroll along. */
  rowLabels: [string, string];
  dots: ZigzagDot[];
  /** Slot of the plus dot (top row, after the last part). */
  plusSlot: number;
  plusLabel: string;
  onAdd: () => void;
}

/** Room above and below the 62 px track so the 44 px tap targets are not clipped by the scroller. */
const PAD_Y = 6;

/**
 * DESIGN §4 zigzag on the "Schuifbare set-rij", shared by unilateral (D1U, L/R)
 * and superset (E2, A/B): one 28 px dot per part, top row and bottom row, a
 * line from centre to centre (accent when the part it leaves is done) and the
 * plus dot last on the top row. 44 × 44 tap targets centred on the dots; a fixed
 * step of 46 px, so a wider row scrolls (see `LiveSetRowScroller`). Slots that
 * are not listed (an empty superset part) get no dot and no line.
 */
export function LiveZigzagRow({ label, rowLabels, dots, plusSlot, plusLabel, onAdd }: LiveZigzagRowProps) {
  const layout = zigzagTrack([...dots.map(d => d.slot), plusSlot]);
  const opened = dots.find(d => d.pressed)?.key ?? -1;
  const hit =
    'absolute flex h-touch w-touch -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const dot = 'box-border flex h-7 w-7 items-center justify-center rounded-full text-body font-bold';
  const plus = layout.points[dots.length]!;
  const y = (v: number) => v + PAD_Y;

  return (
    <div role="group" aria-label={label}>
      <LiveSetRowScroller
        openedKey={opened}
        count={dots.length}
        // Design margin top 10 (and 0 below) minus the extra room around the track.
        className="-mb-1.5 mt-1"
        contentClassName="relative"
        // border-box: the width includes the 22 px right padding.
        contentStyle={{ width: layout.width + 22, height: 62 + 2 * PAD_Y }}
      >
        <span aria-hidden="true" className="absolute left-0 text-small font-semibold text-muted" style={{ top: y(9) }}>{rowLabels[0]}</span>
        <span aria-hidden="true" className="absolute left-0 text-small font-semibold text-muted" style={{ top: y(39) }}>{rowLabels[1]}</span>
        {layout.lines.map((l, k) => (
          <span
            key={`line-${k}`}
            aria-hidden="true"
            className={cn('absolute h-0.5 origin-left', dots[k]?.lineOn ? 'bg-accent' : 'bg-line')}
            style={{ left: l.x, top: y(l.y) - 1, width: l.length, transform: `rotate(${l.angle}deg)` }}
          />
        ))}
        {dots.map((d, k) => {
          const p = layout.points[k]!;
          return (
            <button
              key={d.key}
              type="button"
              data-testid={d.testId}
              {...d.data}
              data-state={d.state}
              aria-label={d.ariaLabel}
              aria-pressed={d.pressed}
              onClick={d.onClick}
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
          aria-label={plusLabel}
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
