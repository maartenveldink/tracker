import { useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { doneListScrollToBottom, type DoneListState, type DoneRow } from '../lib/setRegistration';

interface LiveDoneListProps {
  rows: DoneRow[];
  /** Index of the current exercise: opening another one scrolls to the newest set. */
  exercise: number;
  onOpen: (setIndex: number) => void;
}

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * DESIGN §4 "Gedaan-lijst met verschil": one row per logged set with the
 * difference to the same set last time. The whole row opens that set. The
 * difference is always text with an arrow; colour is only a second signal.
 * Owner decision (deviates from "the last 3" in §5): every logged set, Set 1
 * at the top and the newest at the bottom, in its own scroll area of at most
 * five rows that starts at (and follows new sets to) the bottom.
 */
export function LiveDoneList({ rows, exercise, onOpen }: LiveDoneListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<DoneListState | null>(null);
  const count = rows.length;

  useLayoutEffect(() => {
    const next = { exercise, count };
    const prev = last.current;
    last.current = next;
    const el = ref.current;
    if (!el || !doneListScrollToBottom(prev, next)) return;
    // A newly logged set glides into view; opening an exercise lands there at once.
    const smooth = prev?.exercise === exercise && !reducedMotion();
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    else el.scrollTop = el.scrollHeight;
  }, [exercise, count]);

  if (count === 0) return null;
  return (
    <section className="flex flex-col px-1" aria-labelledby="done-heading">
      <h2 id="done-heading" className="text-small font-semibold uppercase tracking-[0.08em] text-muted">
        Gedaan
      </h2>
      <div
        ref={ref}
        data-testid="done-list"
        className="flex max-h-[min(35vh,220px)] flex-col overflow-y-auto overscroll-y-contain"
      >
        {rows.map(r => (
          <button
            key={r.index}
            type="button"
            data-testid="done-row"
            aria-label={r.ariaLabel}
            onClick={() => onOpen(r.index)}
            className="flex h-touch shrink-0 items-center justify-between gap-3 border-b border-line text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="min-w-0 truncate text-body">{r.label}</span>
            <span
              className={cn(
                'shrink-0 text-body',
                r.delta.kind === 'up' && 'font-bold text-accent',
                r.delta.kind === 'down' && 'font-bold text-worse',
                (r.delta.kind === 'same' || r.delta.kind === 'new') && 'text-muted',
              )}
            >
              {r.delta.text}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
