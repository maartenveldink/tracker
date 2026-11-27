import { useLayoutEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { zigzagLayout, type SideDot } from '../lib/setRegistration';

interface LiveSideProgressProps {
  dots: SideDot[];
  canAdd: boolean;
  onOpen: (setIndex: number) => void;
  onAdd: () => void;
}

/** Design width of the row (390 screen − 2 × 20 margin); used until measured. */
const DESIGN_WIDTH = 350;

/**
 * DESIGN §4 "Set-voortgang, unilateraal" (`TrainingD1U.dc.html`): one dot per
 * part, left on the top row and right on the bottom row, in zigzag order
 * L1 → R1 → L2 → R2 with a line from centre to centre, and the plus dot on the
 * top row at the end (hidden at the maximum). There is no side label or
 * switch: the row of the opened dot shows the side. Dots are 28 px with a
 * 44 × 44 tap target centred on them; the step shrinks with many sets (stays
 * on one line without scrolling, the targets then overlap, §12 q13).
 */
export function LiveSideProgress({ dots, canAdd, onOpen, onAdd }: LiveSideProgressProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DESIGN_WIDTH);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth || DESIGN_WIDTH);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = zigzagLayout(dots.length, width);
  const lineCount = canAdd ? layout.lines.length : Math.max(0, dots.length - 1);
  const hit =
    'absolute flex h-touch w-touch -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const dot = 'box-border flex h-7 w-7 items-center justify-center rounded-full text-body font-bold';
  const plus = layout.points[dots.length]!;

  return (
    <div ref={ref} className="relative mt-2.5 h-[62px]" role="group" aria-label="Sets, links en rechts">
      <span aria-hidden="true" className="absolute left-0 top-[9px] text-small font-semibold text-muted">L</span>
      <span aria-hidden="true" className="absolute left-0 top-[39px] text-small font-semibold text-muted">R</span>
      {layout.lines.slice(0, lineCount).map((l, k) => (
        <span
          key={`line-${k}`}
          aria-hidden="true"
          className={cn('absolute h-0.5 origin-left', k < dots.length && dots[k]!.lineOn ? 'bg-accent' : 'bg-line')}
          style={{ left: l.x, top: l.y - 1, width: l.length, transform: `rotate(${l.angle}deg)` }}
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
            style={{ left: p.x, top: p.y }}
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
      {canAdd && (
        <button
          type="button"
          aria-label="Set toevoegen"
          onClick={onAdd}
          className={hit}
          style={{ left: plus.x, top: plus.y }}
        >
          <span className={cn(dot, 'border-[1.5px] border-dashed border-line-strong bg-bg text-accent')}>
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          </span>
        </button>
      )}
    </div>
  );
}
