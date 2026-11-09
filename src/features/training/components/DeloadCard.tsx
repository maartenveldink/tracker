import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BatteryLow } from 'lucide-react';
import { useCompletedWorkouts } from '../hooks/useProgress';
import { useExerciseLookup } from '../hooks/useExercises';
import { detectDeload } from '../lib/deload';
import { dismissDeloadNotice, useDeloadDismissedUntil } from '../lib/deloadDismiss';
import { useSettings } from '../../../hooks/useSettings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Dashboard notice "consider a deload week" when the estimated 1RM stagnates or
 * declines across several exercises. Rule: see `lib/deload.ts`. Can be hidden
 * for a week (device-local, see `lib/deloadDismiss.ts`).
 */
export function DeloadCard() {
  const navigate = useNavigate();
  const workouts = useCompletedWorkouts();
  const { byId, loading, nameOf } = useExerciseLookup();
  const settings = useSettings();
  const dismissedUntil = useDeloadDismissedUntil();

  const advice = useMemo(() => {
    if (loading) return null;
    const isKnown = (id: string) => {
      const e = byId.get(id);
      return !!e && !e.deleted;
    };
    return detectDeload(workouts, settings.oneRMFormula, isKnown);
  }, [loading, byId, workouts, settings.oneRMFormula]);

  if (!advice?.suggest || Date.now() < dismissedUntil) return null;

  return (
    <Card className="border-accent/50 bg-accent/5" data-testid="deload-card">
      <CardContent className="p-3">
        <p className="text-small font-medium flex items-center gap-1.5">
          <BatteryLow className="h-4 w-4 text-accent" />
          Overweeg een deload-week
        </p>
        <p className="mt-1 text-caption text-muted-foreground">
          Je geschatte 1RM stagneert of daalt de afgelopen weken bij {advice.exercises.length} van
          de {advice.assessable} oefeningen. Een rustigere week (±50% volume of gewicht) kan helpen
          om weer progressie te maken.
        </p>
        <ul className="mt-2 space-y-1">
          {advice.exercises.map(ex => (
            <li key={ex.exerciseId} className="flex items-center justify-between text-small gap-2">
              <span className="truncate">{nameOf(ex.exerciseId)}</span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                ~{Math.round(ex.recent1RM)} kg ({ex.change >= 0 ? '+' : ''}
                {(ex.change * 100).toFixed(1).replace('.', ',')}%)
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => navigate('/progress')}>
            Bekijk progressie
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => dismissDeloadNotice()}
          >
            Verberg een week
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
