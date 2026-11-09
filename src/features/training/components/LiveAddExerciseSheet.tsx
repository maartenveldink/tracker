import { useState } from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ExerciseForm } from './ExerciseForm';
import type { Exercise } from '../../../db/index';

interface LiveAddExerciseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Exercises that can be added (soft-deleted ones excluded). */
  exercises: Exercise[];
  onAdd: (exerciseId: string) => void;
}

/** Search an existing exercise or create a brand-new one, then add it to the running workout. */
export function LiveAddExerciseSheet({ open, onOpenChange, exercises, onAdd }: LiveAddExerciseSheetProps) {
  const [search, setSearch] = useState('');
  // When set, the sheet shows the full "new exercise" form prefilled with this name.
  const [creating, setCreating] = useState<string | null>(null);

  const term = search.trim();
  const filtered = exercises.filter(e => !term || e.name.toLowerCase().includes(term.toLowerCase()));

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setSearch('');
      setCreating(null);
    }
  }

  function add(exerciseId: string) {
    onAdd(exerciseId);
    setSearch('');
    setCreating(null);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        {creating !== null ? (
          <>
            <SheetHeader>
              <SheetTitle>Nieuwe oefening</SheetTitle>
              <SheetDescription>
                De oefening wordt aangemaakt en meteen aan je training toegevoegd.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <Button variant="ghost" className="mb-3 -ml-2" onClick={() => setCreating(null)}>
                <ChevronLeft aria-hidden="true" />
                Terug naar zoeken
              </Button>
              <ExerciseForm
                initialName={creating}
                submitLabel="Aanmaken & toevoegen"
                onSaved={exerciseId => add(exerciseId)}
              />
            </div>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>Oefening toevoegen</SheetTitle>
              <SheetDescription>Selecteer een oefening om toe te voegen aan je training</SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              <Input
                type="text"
                aria-label="Zoek oefening"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Zoek oefening..."
                autoFocus
              />
              <div className="h-56 space-y-1 overflow-y-auto">
                {filtered.map(ex => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => add(ex.id!)}
                    className="min-h-touch w-full rounded-row px-3 text-left text-body transition-colors hover:bg-line/60"
                  >
                    {ex.name}
                  </button>
                ))}
                {/* A new exercise when the term matches no existing name. */}
                {term && !exercises.some(e => e.name.toLowerCase() === term.toLowerCase()) && (
                  <button
                    type="button"
                    onClick={() => setCreating(term)}
                    className="flex min-h-touch w-full items-center gap-2 rounded-row px-3 text-left text-body text-accent transition-colors hover:bg-line/60"
                  >
                    <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      Nieuwe oefening "<span className="font-semibold">{term}</span>" aanmaken
                    </span>
                  </button>
                )}
                {filtered.length === 0 && !term && (
                  <p className="px-3 py-2 text-small text-muted">Nog geen oefeningen.</p>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
