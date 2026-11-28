import { useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { findSimilarExercises } from '../lib/suggestWorkout';
import type { Exercise } from '../../../db/index';

/**
 * Bottom sheet with similar exercises (same primary muscle) to swap an
 * exercise for; shared by Schema bewerken and the Voorgestelde training.
 * `exercise` = the one being swapped (null = closed); `usedIds` are hidden.
 */
export function SwapExerciseSheet({
  exercise,
  all,
  usedIds,
  onPick,
  onClose,
}: {
  exercise: Exercise | null;
  all: Exercise[];
  usedIds: Set<string>;
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const candidates = useMemo(
    () => (exercise ? findSimilarExercises(exercise, all, usedIds) : []),
    [exercise, all, usedIds],
  );
  return (
    <Sheet open={exercise !== null} onOpenChange={open => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[70vh]">
        <SheetHeader>
          <SheetTitle>Vergelijkbare oefening</SheetTitle>
          <SheetDescription>Kies een alternatief voor dezelfde spiergroep.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 h-64 overflow-y-auto space-y-1">
          {candidates.length === 0 ? (
            <p className="text-small text-muted-foreground px-1 py-4">Geen vergelijkbare oefening gevonden.</p>
          ) : (
            candidates.map(e => (
              <button
                key={e.id}
                type="button"
                onClick={() => onPick(e.id)}
                className="w-full text-left px-3 py-2 text-small rounded-md hover:bg-line/60 transition-colors"
              >
                {e.name}
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
