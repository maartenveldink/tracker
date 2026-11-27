import { cn } from '@/lib/utils';
import type { DoneRow } from '../lib/setRegistration';

interface LiveDoneListProps {
  rows: DoneRow[];
  onOpen: (setIndex: number) => void;
}

/**
 * DESIGN §4 "Gedaan-lijst met verschil": one row per logged set with the
 * difference to the same set last time. The whole row opens that set. The
 * difference is always text with an arrow; colour is only a second signal.
 */
export function LiveDoneList({ rows, onOpen }: LiveDoneListProps) {
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col px-1" aria-labelledby="done-heading">
      <h2 id="done-heading" className="text-small font-semibold uppercase tracking-[0.08em] text-muted">
        Gedaan
      </h2>
      {rows.map(r => (
        <button
          key={r.index}
          type="button"
          data-testid="done-row"
          aria-label={r.ariaLabel}
          onClick={() => onOpen(r.index)}
          className="flex h-touch items-center justify-between gap-3 border-b border-line text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
    </section>
  );
}
