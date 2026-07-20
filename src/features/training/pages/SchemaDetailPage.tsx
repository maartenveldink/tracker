import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSchema, isMultiDay, getAllSchemaExercises, getSortedDays, getRotation } from '../hooks/useSchemas';
import { useExercises } from '../hooks/useExercises';
import { getMuscleGroups, getAllGlobalMuscleIds, getMuscleGroupById } from '../db/muscles';
import { useSettings } from '../../../hooks/useSettings';
import { MuscleChip } from '../components/MuscleChip';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, AlertTriangle, Lightbulb } from 'lucide-react';
import type { Exercise, SchemaExercise } from '../../../db/index';

interface MuscleStats {
  id: string;
  name: string;
  primarySets: number;
  secondarySets: number;
}

interface MuscleAnalysis {
  stats: MuscleStats[];
  missing: { id: string; name: string }[];
  totalSets: number;
}

function computeMuscleAnalysis(
  exercises: SchemaExercise[],
  exerciseMap: Map<number, Exercise>,
  muscleDetailLevel: 'global' | 'detailed' = 'global',
): MuscleAnalysis {
  const statsMap = new Map<string, MuscleStats>();
  const allMuscles = getMuscleGroups(muscleDetailLevel);
  allMuscles.forEach(m => {
    statsMap.set(m.id, { id: m.id, name: m.name, primarySets: 0, secondarySets: 0 });
  });

  let totalSets = 0;
  for (const se of exercises) {
    const exercise = exerciseMap.get(se.exerciseId);
    if (!exercise) continue;

    totalSets += se.sets;
    exercise.primaryMuscles.forEach(muscleId => {
      const stat = statsMap.get(muscleId);
      if (stat) stat.primarySets += se.sets;
    });
    exercise.secondaryMuscles.forEach(muscleId => {
      const stat = statsMap.get(muscleId);
      if (stat) stat.secondarySets += se.sets;
    });
  }

  const stats = Array.from(statsMap.values())
    .filter(s => s.primarySets > 0 || s.secondarySets > 0)
    .sort((a, b) => (b.primarySets + b.secondarySets) - (a.primarySets + a.secondarySets));

  const allGlobalIds = getAllGlobalMuscleIds();
  const coveredIds = new Set(stats.map(s => s.id));
  const missing = allGlobalIds
    .filter(id => !coveredIds.has(id))
    .map(id => getMuscleGroupById(id))
    .filter((m): m is NonNullable<typeof m> => m !== undefined)
    .map(m => ({ id: m.id, name: m.name }));

  return { stats, missing, totalSets };
}

function MuscleStatsSection({ analysis, allExercises }: {
  analysis: MuscleAnalysis;
  allExercises: Exercise[];
}) {
  const suggestions = useMemo(() => {
    if (analysis.missing.length === 0) return [];
    const missingIds = new Set(analysis.missing.map(m => m.id));
    return allExercises
      .filter(e => e.primaryMuscles.some(m => missingIds.has(m)))
      .slice(0, 5);
  }, [analysis.missing, allExercises]);

  return (
    <>
      {/* Muscle group overview (E2-04) */}
      {analysis.stats.length > 0 && (
        <div className="px-4 py-3">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Spiergroepverdeling</h2>
          <div className="space-y-2">
            {analysis.stats.map(stat => {
              const maxSets = analysis.stats[0]
                ? analysis.stats[0].primarySets + analysis.stats[0].secondarySets
                : 1;
              return (
                <div key={stat.id}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-card-foreground">{stat.name}</span>
                    <span className="text-muted-foreground">
                      {stat.primarySets} primair{stat.secondarySets > 0 ? ` + ${stat.secondarySets} sec.` : ''}
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full flex rounded-full">
                      <div
                        className="bg-primary transition-all"
                        style={{ width: `${(stat.primarySets / maxSets) * 100}%` }}
                      />
                      <div
                        className="bg-primary/40 transition-all"
                        style={{ width: `${(stat.secondarySets / maxSets) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Missing muscle groups (E2-05) */}
      {analysis.missing.length > 0 && (
        <>
          <Separator />
          <div className="px-4 py-3">
            <h2 className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Ontbrekende spiergroepen
            </h2>
            <div className="flex flex-wrap gap-1">
              {analysis.missing.map(m => (
                <Badge
                  key={m.id}
                  variant="outline"
                  className="rounded-full bg-amber-900/40 text-amber-300 border-amber-800"
                >
                  {m.name}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Suggestions (E2-06) */}
      {suggestions.length > 0 && (
        <>
          <Separator />
          <div className="px-4 py-3 pb-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4" />
              Suggesties
            </h2>
            <p className="text-xs text-muted-foreground mb-2">
              Deze oefeningen dekken ontbrekende spiergroepen:
            </p>
            <div className="space-y-1">
              {suggestions.map(ex => (
                <Card key={ex.id} className="shadow-none">
                  <CardContent className="p-2 flex items-center gap-2">
                    <span className="text-sm flex-1">{ex.name}</span>
                    <div className="flex gap-1">
                      {ex.primaryMuscles.map(m => (
                        <MuscleChip key={m} muscleId={m} type="primary" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

export function SchemaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const schema = useSchema(id ? Number(id) : undefined);
  const allExercises = useExercises();
  const navigate = useNavigate();

  const exerciseMap = useMemo(() => {
    const map = new Map<number, Exercise>();
    allExercises.forEach(e => map.set(e.id!, e));
    return map;
  }, [allExercises]);

  const settings = useSettings();
  const multiDay = schema ? isMultiDay(schema) : false;
  const sortedDays = useMemo(() => schema ? getSortedDays(schema) : [], [schema]);

  // Analysis for total schema (all exercises across all days)
  const totalAnalysis = useMemo(() => {
    if (!schema) return { stats: [], missing: [], totalSets: 0 };
    const allExs = getAllSchemaExercises(schema);
    return computeMuscleAnalysis(allExs, exerciseMap, settings.muscleDetailLevel);
  }, [schema, exerciseMap, settings.muscleDetailLevel]);

  // Per-day analysis (E2-10)
  const dayAnalyses = useMemo(() => {
    if (!schema || !multiDay) return new Map<string, MuscleAnalysis>();
    const map = new Map<string, MuscleAnalysis>();
    for (const day of sortedDays) {
      map.set(day.id, computeMuscleAnalysis(day.exercises, exerciseMap, settings.muscleDetailLevel));
    }
    return map;
  }, [schema, multiDay, sortedDays, exerciseMap, settings.muscleDetailLevel]);

  const [analysisTab, setAnalysisTab] = useState<string>('totaal');

  if (!schema) {
    return (
      <div>
        <PageHeader title="Schema laden..." backTo="/schemas" />
      </div>
    );
  }

  function renderExerciseList(exercises: SchemaExercise[]) {
    if (exercises.length === 0) {
      return <p className="text-muted-foreground text-sm py-4 text-center">Geen oefeningen.</p>;
    }
    return (
      <div className="space-y-2">
        {exercises.map((se, i) => {
          const exercise = exerciseMap.get(se.exerciseId);
          return (
            <Card key={`${se.exerciseId}-${i}`} className="shadow-none">
              <CardContent className="p-3 flex items-center gap-3">
                <span className="text-muted-foreground text-xs w-5 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{exercise?.name ?? 'Onbekend'}</span>
                  <div className="flex gap-1 mt-1">
                    {exercise?.primaryMuscles.map(m => (
                      <MuscleChip key={m} muscleId={m} type="primary" />
                    ))}
                  </div>
                </div>
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {se.sets}x{se.repsPerSet}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={schema.name}
        backTo="/schemas"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/schemas/${schema.id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
            Bewerken
          </Button>
        }
      />

      {/* Exercise list — single-day or multi-day with tabs */}
      <div className="px-4 py-3">
        {multiDay ? (
          <>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              {sortedDays.length} dagen | {getAllSchemaExercises(schema).length} oefeningen totaal
            </h2>
            {schema.rotation && schema.rotation.length > 0 && (
              <p className="text-xs text-muted-foreground mb-2">
                Ritme:{' '}
                <span className="font-medium text-foreground">
                  {getRotation(schema)
                    .map(id => sortedDays.find(d => d.id === id)?.name ?? '?')
                    .join(' → ')}
                </span>
              </p>
            )}
            <Tabs defaultValue={sortedDays[0]?.id}>
              <TabsList className="w-full flex overflow-x-auto">
                {sortedDays.map(day => (
                  <TabsTrigger key={day.id} value={day.id} className="flex-1 min-w-0">
                    <span className="truncate">{day.name}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {sortedDays.map(day => (
                <TabsContent key={day.id} value={day.id} className="mt-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    {day.exercises.length} oefening{day.exercises.length !== 1 ? 'en' : ''} |{' '}
                    {day.exercises.reduce((sum, e) => sum + e.sets, 0)} sets
                  </p>
                  {renderExerciseList(day.exercises)}
                </TabsContent>
              ))}
            </Tabs>
          </>
        ) : (
          <>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              Oefeningen ({schema.exercises.length})
            </h2>
            {schema.exercises.length === 0 && (
              <p className="text-muted-foreground text-sm py-4 text-center">Geen oefeningen in dit schema.</p>
            )}
            {renderExerciseList(schema.exercises)}
          </>
        )}
      </div>

      {/* Muscle analysis section (E2-04, E2-05, E2-06, E2-10) */}
      <Separator />
      {multiDay ? (
        <Tabs value={analysisTab} onValueChange={setAnalysisTab}>
          <div className="px-4 pt-3">
            <TabsList className="w-full flex overflow-x-auto">
              <TabsTrigger value="totaal" className="flex-1">
                Totaal
              </TabsTrigger>
              {sortedDays.map(day => (
                <TabsTrigger key={day.id} value={day.id} className="flex-1 min-w-0">
                  <span className="truncate">{day.name}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="totaal">
            <MuscleStatsSection analysis={totalAnalysis} allExercises={allExercises} />
          </TabsContent>
          {sortedDays.map(day => {
            const dayAnalysis = dayAnalyses.get(day.id);
            if (!dayAnalysis) return null;
            return (
              <TabsContent key={day.id} value={day.id}>
                <MuscleStatsSection analysis={dayAnalysis} allExercises={allExercises} />
              </TabsContent>
            );
          })}
        </Tabs>
      ) : (
        <MuscleStatsSection analysis={totalAnalysis} allExercises={allExercises} />
      )}
    </div>
  );
}
