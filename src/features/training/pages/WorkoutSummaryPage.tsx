import { useMemo } from 'react';
import { formatDurationLong } from '../../../lib/utils';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useWorkout } from '../hooks/useWorkout';
import { useExercises } from '../hooks/useExercises';
import { useCompletedWorkouts, calculate1RM } from '../hooks/useProgress';
import { calculateStreak, volumePerMuscleGroup } from '../lib/metrics';
import { useSettings } from '../../../hooks/useSettings';
import { getMuscleGroupById } from '../db/muscles';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { X, Clock, Layers, Weight, ArrowRight, Share2 } from 'lucide-react';
import { shareText } from '../../../lib/share';
import type { Exercise, Workout } from '../../../db/index';

function formatDate(date: Date): string {
  return date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

export function WorkoutSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const workoutId = id ? Number(id) : undefined;
  const workout = useWorkout(workoutId);
  const allExercises = useExercises();
  const completedWorkouts = useCompletedWorkouts();
  const settings = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const closeTo = (location.state as { from?: string } | null)?.from ?? '/start';

  const exerciseMap = useMemo(() => {
    const map = new Map<number, Exercise>();
    allExercises.forEach(e => map.set(e.id!, e));
    return map;
  }, [allExercises]);

  // Volume per muscle group (E3-08)
  const muscleVolume = useMemo(
    () => (workout ? volumePerMuscleGroup([workout], exerciseMap) : new Map<string, number>()),
    [workout, exerciseMap],
  );

  // MF-03: PR detection per exercise
  const prExercises = useMemo(() => {
    if (!workout) return new Set<number>();
    const prSet = new Set<number>();

    for (const we of workout.exercises) {
      // Best 1RM from this session
      let bestThisSession = 0;
      for (const set of we.sets) {
        if (!set.completed || !set.weight || set.weight <= 0 || !set.actualReps || set.actualReps <= 0) continue;
        const est = calculate1RM(set.weight, set.actualReps, settings.oneRMFormula);
        if (est > bestThisSession) bestThisSession = est;
      }
      if (bestThisSession <= 0) continue;

      // Best 1RM from all previous sessions
      let bestPrevious = 0;
      for (const w of completedWorkouts) {
        if (w.id === workout.id) continue;
        const ex = w.exercises.find(e => e.exerciseId === we.exerciseId);
        if (!ex) continue;
        for (const set of ex.sets) {
          if (!set.completed || !set.weight || set.weight <= 0 || !set.actualReps || set.actualReps <= 0) continue;
          const est = calculate1RM(set.weight, set.actualReps, settings.oneRMFormula);
          if (est > bestPrevious) bestPrevious = est;
        }
      }

      if (bestThisSession > bestPrevious && bestPrevious > 0) {
        prSet.add(we.exerciseId);
      }
    }

    return prSet;
  }, [workout, completedWorkouts, settings.oneRMFormula]);

  // MF-04: Volume comparison with previous session of same schema
  const volumeComparison = useMemo<{ current: number; previous: number | null }>(() => {
    if (!workout) return { current: 0, previous: null };

    const current = workout.exercises.reduce((sum, we) => {
      return sum + we.sets
        .filter(s => s.completed && s.weight && s.actualReps)
        .reduce((setSum, s) => setSum + (s.weight! * s.actualReps!), 0);
    }, 0);

    if (!workout.schemaId) return { current, previous: null };

    // Find previous workout with same schemaId
    let previousWorkout: Workout | null = null;
    for (let i = completedWorkouts.length - 1; i >= 0; i--) {
      const w = completedWorkouts[i];
      if (!w) continue;
      if (w.id === workout.id) continue;
      if (w.schemaId === workout.schemaId) {
        previousWorkout = w;
        break;
      }
    }

    if (!previousWorkout) return { current, previous: null };

    const previous = previousWorkout.exercises.reduce((sum, we) => {
      return sum + we.sets
        .filter(s => s.completed && s.weight && s.actualReps)
        .reduce((setSum, s) => setSum + (s.weight! * s.actualReps!), 0);
    }, 0);

    return { current, previous };
  }, [workout, completedWorkouts]);

  // MF-05: Training streak
  const streak = useMemo(() => calculateStreak(completedWorkouts), [completedWorkouts]);

  if (!workout) {
    return (
      <div>
        <PageHeader title="Laden..." backTo="/start" />
      </div>
    );
  }

  const duration = workout.completedAt
    ? workout.completedAt.getTime() - workout.startedAt.getTime() - workout.totalPausedMs
    : 0;

  const totalSetsCompleted = workout.exercises.reduce(
    (sum, e) => sum + e.sets.filter(s => s.completed).length,
    0,
  );

  const totalVolume = workout.exercises.reduce((sum, we) => {
    return sum + we.sets
      .filter(s => s.completed && s.weight && s.actualReps)
      .reduce((setSum, s) => setSum + (s.weight! * s.actualReps!), 0);
  }, 0);

  const sortedMuscleVolume = Array.from(muscleVolume.entries())
    .map(([id, vol]) => ({ id, name: getMuscleGroupById(id)?.name ?? id, volume: vol }))
    .sort((a, b) => b.volume - a.volume);

  const volumeDiff = volumeComparison.previous !== null
    ? Math.round(volumeComparison.current - volumeComparison.previous)
    : null;

  async function shareSummary() {
    if (!workout) return;
    const title = `${workout.schemaName ?? 'Losse training'}${workout.schemaDayName ? ` - ${workout.schemaDayName}` : ''}`;
    const lines: string[] = [
      `🏋️ ${title} — ${formatDate(workout.startedAt)}`,
      `⏱️ ${formatDurationLong(duration)} · ${totalSetsCompleted} sets · ${Math.round(totalVolume)} kg volume`,
      '',
    ];
    for (const we of workout.exercises) {
      const exercise = exerciseMap.get(we.exerciseId);
      const done = we.sets.filter(s => s.completed);
      if (done.length === 0) continue;
      const setsText = done.map(s => `${s.weight ?? 0}×${s.actualReps ?? 0}`).join(', ');
      const pr = prExercises.has(we.exerciseId) ? ' 🏆' : '';
      lines.push(`• ${exercise?.name ?? 'Onbekend'}: ${setsText}${pr}`);
    }
    await shareText(lines.join('\n'), title);
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Samenvatting"
        actions={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={shareSummary}>
              <Share2 className="h-4 w-4" />
              Deel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(closeTo)}
            >
              <X className="h-4 w-4" />
              Sluiten
            </Button>
          </div>
        }
      />

      {/* Quick stats */}
      <div className="px-4 py-4">
        <h2 className="text-lg font-semibold mb-1">
          {workout.schemaName ?? 'Losse training'}
          {workout.schemaDayName && (
            <span className="text-muted-foreground font-normal"> - {workout.schemaDayName}</span>
          )}
        </h2>
        <p className="text-muted-foreground text-sm">{formatDate(workout.startedAt)}</p>

        {/* MF-05: streak */}
        {streak >= 2 && (
          <p className="text-sm font-medium text-amber-400 mt-1">
            {'\uD83D\uDD25'} {streak} weken op rij getraind
          </p>
        )}

        {/* MF-04: volume comparison */}
        {volumeDiff !== null && (
          <p className="text-sm text-muted-foreground mt-1">
            Volume: {Math.round(volumeComparison.current)} kg{' '}
            <span className={volumeDiff >= 0 ? 'text-green-400' : 'text-red-400'}>
              ({volumeDiff >= 0 ? '+' : ''}{volumeDiff} kg t.o.v. vorige sessie)
            </span>
          </p>
        )}

        <div className="grid grid-cols-3 gap-3 mt-4">
          <Card className="shadow-none">
            <CardContent className="p-3 text-center">
              <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <div className="text-lg font-bold">{formatDurationLong(duration)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Duur</div>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-3 text-center">
              <Layers className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <div className="text-lg font-bold">{totalSetsCompleted}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Sets</div>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-3 text-center">
              <Weight className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <div className="text-lg font-bold">{totalVolume > 0 ? `${Math.round(totalVolume)}` : '-'}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Volume (kg)</div>
            </CardContent>
          </Card>
        </div>

        <div className="text-xs text-muted-foreground mt-2 text-center">
          {formatTime(workout.startedAt)} - {workout.completedAt ? formatTime(workout.completedAt) : '?'}
        </div>
      </div>

      {/* Exercises detail */}
      <Separator />
      <div className="px-4 py-3">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Oefeningen</h3>
        <div className="space-y-3">
          {workout.exercises.map((we, idx) => {
            const exercise = exerciseMap.get(we.exerciseId);
            const completedSets = we.sets.filter(s => s.completed);
            const isPR = prExercises.has(we.exerciseId);

            return (
              <Card key={`${we.exerciseId}-${idx}`} className="shadow-none">
                <CardContent className="p-3">
                  <h4 className="text-sm font-medium mb-1 flex items-center gap-1.5">
                    {exercise?.name ?? 'Onbekend'}
                    {/* MF-03: PR badge */}
                    {isPR && (
                      <span className="text-xs text-amber-400 font-medium">
                        {'\uD83C\uDFC6'} Persoonlijk record!
                      </span>
                    )}
                  </h4>
                  {completedSets.length > 0 ? (
                    <div className="space-y-0.5">
                      {completedSets.map((set) => (
                        <div key={set.setNumber} className="text-xs text-muted-foreground flex gap-2">
                          <span className="text-muted-foreground/60 w-8">Set {set.setNumber}</span>
                          <span>{set.weight ?? 0} kg x {set.actualReps ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Geen sets voltooid</p>
                  )}
                  {we.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">{we.notes}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Volume per muscle group (E3-08) */}
      {sortedMuscleVolume.length > 0 && (
        <>
          <Separator />
          <div className="px-4 py-3">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Volume per spiergroep</h3>
            <div className="space-y-2">
              {sortedMuscleVolume.map(({ id, name, volume }) => {
                const maxVolume = sortedMuscleVolume[0]?.volume ?? 1;
                const percentage = (volume / maxVolume) * 100;

                return (
                  <div key={id}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-card-foreground">{name}</span>
                      <span className="text-muted-foreground">{Math.round(volume)} kg</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Workout notes */}
      {workout.notes && (
        <>
          <Separator />
          <div className="px-4 py-3">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Trainingsnotities</h3>
            <p className="text-sm text-card-foreground">{workout.notes}</p>
          </div>
        </>
      )}

      {/* CT-05: Next session button */}
      <Separator />
      <div className="px-4 py-4 pb-8">
        <Button
          className="w-full"
          onClick={() => {
            if (workout.schemaId) {
              navigate('/start', { state: { suggestedSchemaId: workout.schemaId } });
            } else {
              navigate('/start');
            }
          }}
        >
          <ArrowRight className="h-4 w-4" />
          Volgende sessie starten
        </Button>
      </div>
    </div>
  );
}
