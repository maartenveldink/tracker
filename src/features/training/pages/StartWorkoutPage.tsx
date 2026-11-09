import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchemas, isMultiDay, getSortedDays, getAllSchemaExercises } from '../hooks/useSchemas';
import { useActiveWorkout, startWorkout } from '../hooks/useWorkout';
import { useCompletedWorkouts } from '../hooks/useProgress';
import { useExercises } from '../hooks/useExercises';
import { buildWorkoutExercises, seedHistoryWeights } from '../lib/workoutBuild';
import { visibleSchemas, hasHiddenSchemas } from '../lib/activeSchemas';
import { daysAgo, nextDayId, nextTraining, primaryMuscleNames } from '../lib/home';
import { estimateExercisesSeconds, formatEstimatedTime } from '../lib/estimateSchemaTime';
import { useSettings } from '../../../hooks/useSettings';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { History, Play } from 'lucide-react';
import type { SchemaExercise, WorkoutExercise, TrainingSchema } from '../../../db/index';

function agoLabel(days: number): string {
  if (days <= 0) return 'vandaag';
  if (days === 1) return 'gisteren';
  return `${days} dagen geleden`;
}

// CT-02: format "X dagen geleden" or "Nog niet getraind"
function lastSessionLabel(date: Date | undefined, now: Date): string {
  if (!date) return 'Nog niet getraind';
  const d = daysAgo(date, now);
  return d <= 0 ? 'Vandaag' : d === 1 ? 'Gisteren' : `${d} dagen geleden`;
}

const countLabel = (n: number) => `${n} ${n === 1 ? 'oefening' : 'oefeningen'}`;

export function StartWorkoutPage() {
  const allSchemas = useSchemas();
  const schemas = useMemo(() => visibleSchemas(allSchemas), [allSchemas]);
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

  // CT-02: last session date per schema
  const lastSessionBySchema = useMemo(() => {
    const map = new Map<string, Date>();
    for (const w of completedWorkouts) {
      if (w.schemaId === null) continue;
      const existing = map.get(w.schemaId);
      if (!existing || w.startedAt > existing) map.set(w.schemaId, w.startedAt);
    }
    return map;
  }, [completedWorkouts]);

  const next = useMemo(() => nextTraining(schemas, completedWorkouts), [schemas, completedWorkouts]);

  // E3-38: seed planned weights from history (with progressive overload).
  const seedWeights = (ex: WorkoutExercise[]) =>
    seedHistoryWeights(ex, completedWorkouts, exerciseById, settings);

  const metaFor = (list: SchemaExercise[]) =>
    `${countLabel(list.length)} · ca. ${formatEstimatedTime(estimateExercisesSeconds(list, exerciseById, settings)).replace('~', '')}`;

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
          <p className="text-muted">
            Je hebt een {activeWorkout.status === 'paused' ? 'gepauzeerde' : 'actieve'} training.
          </p>
          {activeWorkout.schemaDayName && (
            <p className="text-caption text-muted">
              {activeWorkout.schemaName} - {activeWorkout.schemaDayName}
            </p>
          )}
          <Button size="lg" onClick={() => navigate(`/workout/${activeWorkout.id}`)}>
            <Play className="h-5 w-5 fill-current" />
            {activeWorkout.status === 'paused' ? 'Hervat training' : 'Ga naar training'}
          </Button>
        </div>
      </div>
    );
  }

  async function handleStartSingleDay(schema: TrainingSchema) {
    const built = seedWeights(buildWorkoutExercises(schema.exercises, exerciseById));
    const workoutId = await startWorkout(schema.id!, schema.name, built);
    navigate(`/workout/${workoutId}`);
  }

  async function handleStartDay(schema: TrainingSchema, dayId: string) {
    const day = getSortedDays(schema).find(d => d.id === dayId);
    if (!day) return;
    const built = seedWeights(buildWorkoutExercises(day.exercises, exerciseById));
    const workoutId = await startWorkout(schema.id!, schema.name, built, day.id, day.name);
    navigate(`/workout/${workoutId}`);
  }

  function startNext() {
    if (!next) return;
    if (!next.day && isMultiDay(next.schema)) return;
    return next.day ? handleStartDay(next.schema, next.day.id) : handleStartSingleDay(next.schema);
  }

  async function handleStartAdHoc() {
    const workoutId = await startWorkout(null, null, []);
    navigate(`/workout/${workoutId}`);
  }

  const now = new Date();
  const hero = next && {
    title: next.day?.name ?? next.schema.name,
    exercises: next.day ? next.day.exercises : getAllSchemaExercises(next.schema),
  };

  return (
    <div>
      <PageHeader
        title="Start training"
        actions={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/start/history')}
            aria-label="Trainingshistorie"
          >
            <History className="h-5 w-5" />
          </Button>
        }
      />

      <div className="px-5 py-4 flex flex-col gap-3.5">
        {/* Suggested training: next schema day (rotation), else the muscle-based suggestion */}
        <Card className="border-2 border-accent p-[18px] flex flex-col gap-3.5" data-testid="suggested-card">
          {hero ? (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-caption font-semibold uppercase tracking-[0.08em] text-accent">Voorgesteld</span>
                <h2 className="font-display text-hero font-bold leading-tight tracking-tight">{hero.title}</h2>
                <p className="text-small text-muted">
                  {primaryMuscleNames(hero.exercises.map(e => e.exerciseId), exerciseById).join(' · ')}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
                <span>{metaFor(hero.exercises)}</span>
                {next.lastDate && <span>Laatst {agoLabel(daysAgo(next.lastDate, now))}</span>}
              </div>
              <Button size="lg" onClick={startNext}>
                <Play className="h-5 w-5 fill-current" />
                Start {hero.title}
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-caption font-semibold uppercase tracking-[0.08em] text-accent">Voorgesteld</span>
                <h2 className="font-display text-hero font-bold leading-tight tracking-tight">Voorgestelde training</h2>
                <p className="text-small text-muted">
                  Op maat, gericht op spiergroepen die je lang niet trainde.
                </p>
              </div>
              <Button size="lg" aria-label="Voorgestelde training" onClick={() => navigate('/start/suggestion')}>
                Bekijk voorstel
              </Button>
            </>
          )}
        </Card>

        {/* Muscle-based suggestion stays reachable next to a schema-based hero */}
        {hero && (
          <ListRow
            title="Voorgestelde training"
            subtitle="Op maat, gericht op spiergroepen die je lang niet trainde"
            chevron
            onClick={() => navigate('/start/suggestion')}
          />
        )}

        {/* Schemas (E3-01, E2-11): days of a multi-day schema are listed directly */}
        <div className="flex flex-col gap-4" data-testid="schema-list">
          {schemas.map(schema => {
            const multiDay = isMultiDay(schema);
            const days = multiDay ? getSortedDays(schema) : [];
            const upNext = multiDay ? nextDayId(schema, completedWorkouts) : null;
            return (
              <section key={schema.id} className="flex flex-col gap-2" aria-label={schema.name}>
                <div className="flex items-baseline justify-between gap-3 px-0.5">
                  <h2 className="text-small font-semibold">Uit je schema</h2>
                  <span className="text-caption text-muted text-right">
                    {multiDay && `${schema.name} · ${days.length} dagen`}
                  </span>
                </div>
                <p className="px-0.5 -mt-1 text-caption text-muted">
                  Laatste sessie: {lastSessionLabel(schema.id ? lastSessionBySchema.get(schema.id) : undefined, now)}
                </p>
                {multiDay ? (
                  days.map((day, i) => (
                    <ListRow
                      key={day.id}
                      title={day.name}
                      subtitle={metaFor(day.exercises)}
                      leading={
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-small font-bold ${
                            day.id === upNext ? 'bg-accent text-accent-foreground' : 'bg-line'
                          }`}
                          aria-hidden="true"
                        >
                          {String.fromCharCode(65 + (i % 26))}
                        </span>
                      }
                      chevron
                      onClick={() => handleStartDay(schema, day.id)}
                      aria-label={`Start ${day.name}`}
                    />
                  ))
                ) : (
                  <ListRow
                    title={schema.name}
                    subtitle={metaFor(schema.exercises)}
                    chevron
                    onClick={() => handleStartSingleDay(schema)}
                  />
                )}
              </section>
            );
          })}
        </div>

        {hasHiddenSchemas(allSchemas) && (
          <ListRow
            title="Alle schema's"
            subtitle={`${allSchemas.length - schemas.length} niet actief`}
            chevron
            onClick={() => navigate('/schemas')}
          />
        )}

        {schemas.length === 0 && (
          <p className="text-muted text-small text-center py-2">
            Maak eerst een schema aan om vanuit een schema te starten.
          </p>
        )}

        {/* Ad-hoc option (E3-01) */}
        <ListRow
          dashed
          title="Vrije training"
          subtitle="Start zonder schema, voeg oefeningen toe tijdens het trainen"
          onClick={handleStartAdHoc}
        />
      </div>
    </div>
  );
}
