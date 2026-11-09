import { useState } from 'react';
import { ChevronDown, Dumbbell, Link2, StickyNote } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { MuscleVolumeBars } from './MuscleVolumeBars';
import type { ExerciseStatus } from '../lib/liveTraining';

export interface OverviewRow {
  name: string;
  status: ExerciseStatus;
  isCurrent: boolean;
  meta: string;
  /** Superset label ("A", "B", …) or undefined. */
  superset?: string;
}

interface LiveOverviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: OverviewRow[];
  muscleVolume: Map<string, number>;
  workoutNotes: string;
  onWorkoutNotesChange: (text: string) => void;
  onWorkoutNotesBlur: (text: string) => void;
  onJump: (index: number) => void;
  onSkip: (index: number) => void;
  onRestore: (index: number) => void;
  onAdd: () => void;
}

/** DESIGN §5 "Oefeningenoverzicht": jump to, skip or restore exercises, add one. */
export function LiveOverviewSheet({
  open,
  onOpenChange,
  rows,
  muscleVolume,
  workoutNotes,
  onWorkoutNotesChange,
  onWorkoutNotesBlur,
  onJump,
  onSkip,
  onRestore,
  onAdd,
}: LiveOverviewSheetProps) {
  const [musclesOpen, setMusclesOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const pill =
    'h-touch shrink-0 rounded-pill border px-3 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex flex-col gap-2.5">
        <SheetHeader>
          <SheetTitle>Oefeningen</SheetTitle>
          <SheetDescription className="sr-only">
            Kies een oefening, sla er een over of voeg er een toe.
          </SheetDescription>
        </SheetHeader>

        <ul className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <li
              key={i}
              data-testid="overview-row"
              data-superset={r.superset}
              className={cn(
                'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-row bg-bg pl-3 pr-2.5',
                r.isCurrent ? 'border-2 border-accent' : 'border border-line',
                r.status === 'skipped' && 'opacity-75',
              )}
            >
              <button
                type="button"
                onClick={() => onJump(i)}
                aria-current={r.isCurrent ? 'step' : undefined}
                className="grid h-14 min-w-0 grid-cols-[28px_minmax(0,1fr)] items-center gap-3 text-left"
              >
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold',
                    r.status === 'done'
                      ? 'bg-accent text-on-accent'
                      : r.isCurrent
                        ? 'border-2 border-accent text-accent'
                        : 'bg-line text-muted',
                  )}
                >
                  {r.status === 'done' ? '✓' : i + 1}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {r.superset && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-caption font-semibold text-accent">
                        <Link2 className="h-3 w-3" aria-hidden="true" />
                        {r.superset}
                      </span>
                    )}
                    <span data-testid="overview-name" className="truncate text-body font-semibold">
                      {r.name}
                    </span>
                  </span>
                  <span data-testid="overview-meta" className="text-caption text-muted">
                    {r.meta}
                  </span>
                </span>
              </button>
              {r.status === 'todo' && (
                <button
                  type="button"
                  aria-label={`${r.name} overslaan`}
                  onClick={() => onSkip(i)}
                  className={cn(pill, 'border-line-strong text-text')}
                >
                  Overslaan
                </button>
              )}
              {r.status === 'skipped' && (
                <button
                  type="button"
                  aria-label={`${r.name} terugzetten`}
                  onClick={() => onRestore(i)}
                  className={cn(pill, 'border-accent text-accent')}
                >
                  Terugzetten
                </button>
              )}
              {r.status === 'done' && <span className="text-[13px] text-muted">Klaar</span>}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onAdd}
          className="h-[52px] rounded-row border border-dashed border-accent text-[15px] font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          + Oefening toevoegen
        </button>

        {/* Existing features that the design does not show: kept here, out of the way. */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            aria-expanded={musclesOpen}
            onClick={() => setMusclesOpen(o => !o)}
            className="flex h-touch items-center gap-2 text-small text-muted"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', !musclesOpen && '-rotate-90')} aria-hidden="true" />
            <Dumbbell className="h-4 w-4" aria-hidden="true" />
            Getrainde spiergroepen
          </button>
          {musclesOpen &&
            (muscleVolume.size > 0 ? (
              <MuscleVolumeBars volume={muscleVolume} />
            ) : (
              <p className="text-caption text-muted">
                Nog geen sets voltooid. Zodra je sets logt, zie je hier welke spiergroepen je traint.
              </p>
            ))}
          <button
            type="button"
            aria-expanded={notesOpen}
            onClick={() => setNotesOpen(o => !o)}
            className="flex h-touch items-center gap-2 text-small text-muted"
          >
            <StickyNote className="h-4 w-4" aria-hidden="true" />
            {notesOpen ? 'Trainingsnotities verbergen' : 'Trainingsnotities'}
          </button>
          {notesOpen && (
            <textarea
              value={workoutNotes}
              onChange={e => onWorkoutNotesChange(e.target.value)}
              onBlur={e => onWorkoutNotesBlur(e.currentTarget.value)}
              placeholder="Notities voor deze training..."
              aria-label="Trainingsnotities"
              rows={3}
              className="w-full resize-none rounded-row border border-line-strong bg-bg px-3.5 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
