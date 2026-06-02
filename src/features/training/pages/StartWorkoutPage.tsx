import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchemas, isMultiDay, getSortedDays } from '../hooks/useSchemas';
import { useActiveWorkout, startWorkout } from '../hooks/useWorkout';
import { useCompletedWorkouts } from '../hooks/useProgress';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Zap, Play, Calendar, AlertTriangle } from 'lucide-react';
import type { WorkoutExercise, WorkoutSet, TrainingSchema, SchemaDay, Workout } from '../../../db/index';

/**
 * Determines the default day for a multi-day schema (E2-11).
 * 1. Active/paused workout for this schema -> that day
 * 2. Last completed workout -> next day in sequence (wraps around)
 * 3. No workouts -> first day
 */
function getDefaultDayId(
  schema: TrainingSchema,
  sortedDays: SchemaDay[],
  activeWorkout: Workout | undefined,
  lastCompletedWorkout: Workout | undefined,
): string {
  if (sortedDays.length === 0) return '';

  // Rule 1: active/paused workout for this schema
  if (activeWorkout && activeWorkout.schemaId === schema.id && activeWorkout.schemaDayId) {
    return activeWorkout.schemaDayId;
  }

  // Rule 2: last completed workout -> next day
  if (lastCompletedWorkout && lastCompletedWorkout.schemaDayId) {
    const lastDayIndex = sortedDays.findIndex(d => d.id === lastCompletedWorkout.schemaDayId);
    if (lastDayIndex >= 0) {
      const nextIndex = (lastDayIndex + 1) % sortedDays.length;
      return sortedDays[nextIndex]!.id;
    }
  }

  // Rule 3: no previous workouts -> first day
  return sortedDays[0]!.id;
}

function buildWorkoutExercises(
  exercises: { exerciseId: number; sets: number; repsPerSet: number }[],
): WorkoutExercise[] {
  return exercises.map((se, order) => ({
    exerciseId: se.exerciseId,
    order,
    sets: Array.from({ length: se.sets }, (_, i): WorkoutSet => ({
      exerciseId: se.exerciseId,
      setNumber: i + 1,
      plannedReps: se.repsPerSet,
      actualReps: null,
      weight: null,
      completed: false,
      skipped: false,
    })),
    notes: '',
  }));
}

// CT-02: format "X dagen geleden" or "Nog niet getraind"
function formatDaysAgo(date: Date | null): string {
  if (!date) return 'Nog niet getraind';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Vandaag';
  if (diffDays === 1) return 'Gisteren';
  return `${diffDays} dagen geleden`;
}

export function StartWorkoutPage() {
  const schemas = useSchemas();
  const activeWorkoutState = useActiveWorkout();
  const activeWorkout = activeWorkoutState?.workout;
  const completedWorkouts = useCompletedWorkouts();
  const navigate = useNavigate();

  // Expanded schema card (for day selection on multi-day schemas)
  const [expandedSchemaId, setExpandedSchemaId] = useState<number | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  // CT-06: recent usage warning
  const [recentWarningSchemaId, setRecentWarningSchemaId] = useState<number | null>(null);

  // Last completed workout per multi-day schema — derived from already-loaded completedWorkouts
  // (avoids N+1 queries, one per schema)
  const lastCompletedBySchema = useMemo(() => {
    const map = new Map<number, Workout>();
    for (const w of completedWorkouts) {
      if (w.schemaId === null || !w.schemaDayId) continue;
      const existing = map.get(w.schemaId);
      if (!existing || w.startedAt > existing.startedAt) {
        map.set(w.schemaId, w);
      }
    }
    return map;
  }, [completedWorkouts]);

  // CT-02: last session date per schema
  const lastSessionBySchema = useMemo(() => {
    const map = new Map<number, Date>();
    for (const w of completedWorkouts) {
      if (w.schemaId === null) continue;
      const existing = map.get(w.schemaId);
      if (!existing || w.startedAt > existing) {
        map.set(w.schemaId, w.startedAt);
      }
    }
    return map;
  }, [completedWorkouts]);

  // Still loading from IndexedDB
  if (!activeWorkoutState || activeWorkoutState.isLoading) {
    return (
      <div>
        <PageHeader title="Start training" />
        <div className="min-h-[200px]" />
      </div>
    );
  }

  // If there's an active workout, allow resuming
  if (activeWorkout) {
    return (
      <div>
        <PageHeader title="Training" />
        <div className="px-4 py-8 text-center space-y-4">
          <p className="text-muted-foreground">
            Je hebt een {activeWorkout.status === 'paused' ? 'gepauzeerde' : 'actieve'} training.
          </p>
          {activeWorkout.schemaDayName && (
            <p className="text-xs text-muted-foreground">
              {activeWorkout.schemaName} - {activeWorkout.schemaDayName}
            </p>
          )}
          <Button
            size="lg"
            onClick={() => navigate(`/workout/${activeWorkout.id}`)}
          >
            <Play className="h-4 w-4" />
            {activeWorkout.status === 'paused' ? 'Hervat training' : 'Ga naar training'}
          </Button>
        </div>
      </div>
    );
  }

  // CT-06: check if schema was used recently (< 48 hours)
  function isRecentlyUsed(schemaId: number): boolean {
    const lastDate = lastSessionBySchema.get(schemaId);
    if (!lastDate) return false;
    const hoursSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60);
    return hoursSince < 48;
  }

  async function handleStartSingleDay(schema: TrainingSchema) {
    // CT-06: show warning if recently used
    if (schema.id && isRecentlyUsed(schema.id) && recentWarningSchemaId !== schema.id) {
      setRecentWarningSchemaId(schema.id);
      return;
    }
    setRecentWarningSchemaId(null);

    const exercises = buildWorkoutExercises(schema.exercises);
    const workoutId = await startWorkout(schema.id!, schema.name, exercises);
    navigate(`/workout/${workoutId}`);
  }

  async function handleStartMultiDay(schema: TrainingSchema, dayId: string) {
    // CT-06: show warning if recently used
    if (schema.id && isRecentlyUsed(schema.id) && recentWarningSchemaId !== schema.id) {
      setRecentWarningSchemaId(schema.id);
      return;
    }
    setRecentWarningSchemaId(null);

    const sortedDays = getSortedDays(schema);
    const day = sortedDays.find(d => d.id === dayId);
    if (!day) return;

    const exercises = buildWorkoutExercises(day.exercises);
    const workoutId = await startWorkout(
      schema.id!,
      schema.name,
      exercises,
      day.id,
      day.name,
    );
    navigate(`/workout/${workoutId}`);
  }

  function handleSchemaClick(schema: TrainingSchema) {
    if (!isMultiDay(schema)) {
      handleStartSingleDay(schema);
      return;
    }

    // Toggle expansion for multi-day schemas
    if (expandedSchemaId === schema.id) {
      setExpandedSchemaId(null);
      setSelectedDayId(null);
      setRecentWarningSchemaId(null);
      return;
    }

    const sortedDays = getSortedDays(schema);
    const lastCompleted = lastCompletedBySchema.get(schema.id!);
    const defaultDayId = getDefaultDayId(schema, sortedDays, activeWorkout, lastCompleted);

    setExpandedSchemaId(schema.id!);
    setSelectedDayId(defaultDayId);
    setRecentWarningSchemaId(null);
  }

  async function handleStartAdHoc() {
    const workoutId = await startWorkout(null, null, []);
    navigate(`/workout/${workoutId}`);
  }

  return (
    <div>
      <PageHeader title="Start training" />

      <div className="px-4 py-4 space-y-4">
        {/* Ad-hoc option (E3-01) */}
        <Card
          className="shadow-none cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={handleStartAdHoc}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Losse training</h3>
              <p className="text-muted-foreground text-xs mt-0.5">Start zonder schema, voeg oefeningen toe tijdens het trainen</p>
            </div>
          </CardContent>
        </Card>

        {/* Schema options (E3-01, E2-11) */}
        {schemas.length > 0 && (
          <>
            <Separator />
            <h2 className="text-sm font-medium text-muted-foreground">Vanuit schema</h2>
            <div className="space-y-2">
              {schemas.map(schema => {
                const multiDay = isMultiDay(schema);
                const sortedDays = multiDay ? getSortedDays(schema) : [];
                const isExpanded = expandedSchemaId === schema.id;
                const totalExercises = multiDay
                  ? sortedDays.reduce((sum, d) => sum + d.exercises.length, 0)
                  : schema.exercises.length;
                const totalSets = multiDay
                  ? sortedDays.reduce((sum, d) => sum + d.exercises.reduce((s, e) => s + e.sets, 0), 0)
                  : schema.exercises.reduce((sum, e) => sum + e.sets, 0);

                // CT-02: last session info
                const lastSessionDate = schema.id ? lastSessionBySchema.get(schema.id) ?? null : null;

                return (
                  <div key={schema.id}>
                    <Card
                      className="shadow-none cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => handleSchemaClick(schema)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-sm">{schema.name}</h3>
                            <p className="text-muted-foreground text-xs mt-0.5">
                              {multiDay && `${sortedDays.length} dagen | `}
                              {totalExercises} oefening{totalExercises !== 1 ? 'en' : ''}
                              {' | '}
                              {totalSets} sets
                            </p>
                            {/* CT-02: last session */}
                            <p className="text-muted-foreground/70 text-[11px] mt-0.5">
                              Laatste sessie: {formatDaysAgo(lastSessionDate)}
                            </p>
                          </div>
                          {multiDay && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              <Calendar className="h-3 w-3 mr-1" />
                              Multi-dag
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* CT-06: recent usage warning (single-day) */}
                    {!multiDay && recentWarningSchemaId === schema.id && (
                      <div className="mt-2 ml-2 flex items-start gap-2 rounded-lg bg-amber-900/30 border border-amber-800/50 px-3 py-2">
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-amber-300">Je hebt dit schema recent al gedaan.</p>
                          <Button
                            size="sm"
                            className="mt-1.5 text-xs h-7"
                            onClick={() => handleStartSingleDay(schema)}
                          >
                            Toch starten
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Day selection for multi-day schemas (E2-11) */}
                    {isExpanded && multiDay && (
                      <div className="mt-2 ml-4 space-y-2">
                        <p className="text-xs text-muted-foreground">Kies een dag:</p>
                        {sortedDays.map(day => {
                          const isSelected = selectedDayId === day.id;
                          return (
                            <Card
                              key={day.id}
                              className={`shadow-none cursor-pointer transition-colors ${
                                isSelected
                                  ? 'border-primary bg-primary/5'
                                  : 'hover:bg-accent/50'
                              }`}
                              onClick={() => setSelectedDayId(day.id)}
                            >
                              <CardContent className="p-3 flex items-center gap-3">
                                <div className="flex-1">
                                  <span className="text-sm font-medium">{day.name}</span>
                                  <p className="text-muted-foreground text-xs">
                                    {day.exercises.length} oefening{day.exercises.length !== 1 ? 'en' : ''}
                                    {' | '}
                                    {day.exercises.reduce((sum, e) => sum + e.sets, 0)} sets
                                  </p>
                                </div>
                                {isSelected && (
                                  <Badge variant="secondary" className="text-xs">
                                    Geselecteerd
                                  </Badge>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}

                        {/* CT-06: recent usage warning (multi-day) */}
                        {recentWarningSchemaId === schema.id && (
                          <div className="flex items-start gap-2 rounded-lg bg-amber-900/30 border border-amber-800/50 px-3 py-2">
                            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-300">
                              Je hebt dit schema recent al gedaan. Klik nogmaals om toch te starten.
                            </p>
                          </div>
                        )}

                        <Button
                          className="w-full mt-2"
                          disabled={!selectedDayId}
                          onClick={() => {
                            if (selectedDayId) {
                              handleStartMultiDay(schema, selectedDayId);
                            }
                          }}
                        >
                          <Play className="h-4 w-4" />
                          Start {sortedDays.find(d => d.id === selectedDayId)?.name ?? 'training'}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {schemas.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-4">
            Maak eerst een schema aan om vanuit een schema te starten.
          </p>
        )}
      </div>
    </div>
  );
}
