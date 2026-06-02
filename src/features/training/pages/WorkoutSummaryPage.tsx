import { useMemo } from 'react';
import { formatDurationLong } from '../../../lib/utils';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkout } from '../hooks/useWorkout';
import { useExercises } from '../hooks/useExercises';
import { getMuscleGroupById } from '../db/muscles';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { X, Clock, Layers, Weight } from 'lucide-react';
import type { Exercise } from '../../../db/index';

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
  const workout = useWorkout(id ? Number(id) : undefined);
  const allExercises = useExercises();
  const navigate = useNavigate();

  const exerciseMap = useMemo(() => {
    const map = new Map<number, Exercise>();
    allExercises.forEach(e => map.set(e.id!, e));
    return map;
  }, [allExercises]);

  // Volume per muscle group (E3-08)
  const muscleVolume = useMemo(() => {
    if (!workout) return new Map<string, number>();

    const volumeMap = new Map<string, number>();
    for (const we of workout.exercises) {
      const exercise = exerciseMap.get(we.exerciseId);
      if (!exercise) continue;

      for (const set of we.sets) {
        if (!set.completed || !set.weight || !set.actualReps) continue;
        const volume = set.weight * set.actualReps;

        for (const muscleId of exercise.primaryMuscles) {
          volumeMap.set(muscleId, (volumeMap.get(muscleId) ?? 0) + volume);
        }
        for (const muscleId of exercise.secondaryMuscles) {
          volumeMap.set(muscleId, (volumeMap.get(muscleId) ?? 0) + volume * 0.5);
        }
      }
    }
    return volumeMap;
  }, [workout, exerciseMap]);

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

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Samenvatting"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/start')}
          >
            <X className="h-4 w-4" />
            Sluiten
          </Button>
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
          {workout.exercises.map((we) => {
            const exercise = exerciseMap.get(we.exerciseId);
            const completedSets = we.sets.filter(s => s.completed);

            return (
              <Card key={we.exerciseId} className="shadow-none">
                <CardContent className="p-3">
                  <h4 className="text-sm font-medium mb-1">{exercise?.name ?? 'Onbekend'}</h4>
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
          <div className="px-4 py-3 pb-8">
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
          <div className="px-4 py-3 pb-8">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Trainingsnotities</h3>
            <p className="text-sm text-card-foreground">{workout.notes}</p>
          </div>
        </>
      )}
    </div>
  );
}
