import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchemas, isMultiDay, getSortedDays, getRotation } from '../hooks/useSchemas';
import { useActiveWorkout, startWorkout } from '../hooks/useWorkout';
import { useCompletedWorkouts } from '../hooks/useProgress';
import { useExercises } from '../hooks/useExercises';
import { buildWorkoutExercises, seedHistoryWeights } from '../lib/workoutBuild';
import { useSettings } from '../../../hooks/useSettings';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Zap, Play, Calendar, History, Sparkles } from 'lucide-react';
import type { WorkoutExercise, TrainingSchema, SchemaDay, Workout } from '../../../db/index';

/**
 * Determines the default day for a multi-day schema (E2-11), following the
 * schema's repetition rhythm (rotation).
 * 1. Active/paused workout for this schema -> that day
 * 2. Otherwise -> next step in the rhythm, based on how many sessions were done
 * 3. Fallback -> first day
 */
function getDefaultDayId(
  schema: TrainingSchema,
  sortedDays: SchemaDay[],
  rotation: string[],
  activeWorkout: Workout | undefined,
  completedCount: number,
): string {
  if (sortedDays.length === 0) return '';

  // Rule 1: active/paused workout for this schema
  if (activeWorkout && activeWorkout.schemaId === schema.id && activeWorkout.schemaDayId) {
    return activeWorkout.schemaDayId;
  }

  // Rule 2: next step in the rhythm. The number of completed sessions for this
  // schema is the position in the cycle (wraps around via modulo).
  if (rotation.length > 0) {
    const nextIndex = completedCount % rotation.length;
    return rotation[nextIndex] ?? sortedDays[0]!.id;
  }

  // Rule 3: fallback
  return sortedDays[0]!.id;
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
  const exercises = useExercises();
  const settings = useSettings();
  const navigate = useNavigate();

  const exerciseById = useMemo(
    () => new Map(exercises.map(e => [e.id!, e])),
    [exercises],
  );

  // E3-38: seed planned weights from history (with progressive overload).
  const seedWeights = (ex: WorkoutExercise[]) =>
    seedHistoryWeights(ex, completedWorkouts, exerciseById, settings);

  // Expanded schema card (for day selection on multi-day schemas)
  const [expandedSchemaId, setExpandedSchemaId] = useState<number | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  // Completed multi-day sessions per schema — the position in the rhythm cycle.
  // Derived from already-loaded completedWorkouts (avoids N+1 queries).
  const completedCountBySchema = useMemo(() => {
    const map = new Map<number, number>();
    for (const w of completedWorkouts) {
      if (w.schemaId === null || !w.schemaDayId) continue;
      map.set(w.schemaId, (map.get(w.schemaId) ?? 0) + 1);
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

  async function handleStartSingleDay(schema: TrainingSchema) {
    const exercises = seedWeights(buildWorkoutExercises(schema.exercises, exerciseById));
    const workoutId = await startWorkout(schema.id!, schema.name, exercises);
    navigate(`/workout/${workoutId}`);
  }

  async function handleStartMultiDay(schema: TrainingSchema, dayId: string) {
    const sortedDays = getSortedDays(schema);
    const day = sortedDays.find(d => d.id === dayId);
    if (!day) return;

    const exercises = seedWeights(buildWorkoutExercises(day.exercises, exerciseById));
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
      return;
    }

    const sortedDays = getSortedDays(schema);
    const rotation = getRotation(schema);
    const completedCount = completedCountBySchema.get(schema.id!) ?? 0;
    const defaultDayId = getDefaultDayId(schema, sortedDays, rotation, activeWorkout, completedCount);

    setExpandedSchemaId(schema.id!);
    setSelectedDayId(defaultDayId);
  }

  async function handleStartAdHoc() {
    const workoutId = await startWorkout(null, null, []);
    navigate(`/workout/${workoutId}`);
  }

  return (
    <div>
      <PageHeader
        title="Start training"
        actions={
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => navigate('/start/history')}
            aria-label="Trainingshistorie"
          >
            <History className="h-5 w-5" />
          </Button>
        }
      />

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
              <h3 className="font-medium text-sm">Vrije training</h3>
              <p className="text-muted-foreground text-xs mt-0.5">Start zonder schema, voeg oefeningen toe tijdens het trainen</p>
            </div>
          </CardContent>
        </Card>

        {/* Suggested workout based on undertrained muscle groups */}
        <Card
          className="shadow-none cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate('/start/suggestion')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Voorgestelde training</h3>
              <p className="text-muted-foreground text-xs mt-0.5">Op maat, gericht op spiergroepen die je lang niet trainde</p>
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
