import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSchema, isMultiDay, getAllSchemaExercises, getSortedDays, getRotation } from '../hooks/useSchemas';
import { useExercises } from '../hooks/useExercises';
import { getMuscleGroups, getAllGlobalMuscleIds, getMuscleGroupById } from '../db/muscles';
import { useSettings } from '../../../hooks/useSettings';
import { MuscleChip } from '../components/MuscleChip';
import { formatReps } from '../lib/reps';
import { estimateExercisesSeconds, formatEstimatedTime } from '../lib/estimateSchemaTime';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, AlertTriangle, Lightbulb, Share2, Copy, Check, Link2 } from 'lucide-react';
import { groupSupersets, supersetBlocks } from '../lib/superset';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { buildSharedSchema, encodeSchemaShareUrl } from '../lib/schemaShare';
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

function MuscleStatsSection({ analysis, allExercises, exercises, exerciseMap }: {
  analysis: MuscleAnalysis;
  allExercises: Exercise[];
  exercises: SchemaExercise[];
  exerciseMap: Map<number, Exercise>;
}) {
  const [selected, setSelected] = useState<MuscleStats | null>(null);

  const suggestions = useMemo(() => {
    if (analysis.missing.length === 0) return [];
    const missingIds = new Set(analysis.missing.map(m => m.id));
    return allExercises
      .filter(e => e.primaryMuscles.some(m => missingIds.has(m)))
      .slice(0, 5);
  }, [analysis.missing, allExercises]);

  // Exercises training the selected muscle, split by primary vs secondary role.
  const selectedExercises = useMemo(() => {
    if (!selected) return { primary: [], secondary: [] } as {
      primary: { name: string; sets: number }[];
      secondary: { name: string; sets: number }[];
    };
    const primary: { name: string; sets: number }[] = [];
    const secondary: { name: string; sets: number }[] = [];
    for (const se of exercises) {
      const ex = exerciseMap.get(se.exerciseId);
      if (!ex) continue;
      const entry = { name: ex.name, sets: se.sets };
      if (ex.primaryMuscles.includes(selected.id)) primary.push(entry);
      else if (ex.secondaryMuscles.includes(selected.id)) secondary.push(entry);
    }
    return { primary, secondary };
  }, [selected, exercises, exerciseMap]);

  return (
    <>
      {/* Muscle group overview (E2-04) */}
      {analysis.stats.length > 0 && (
        <div className="px-4 py-3">
          <h2 className="text-sm font-medium text-muted-foreground">Spiergroepverdeling</h2>
          <p className="text-xs text-muted-foreground/80 mb-2">
            Aantal sets per spiergroep (primair + secundair) — tik voor de oefeningen.
          </p>
          <div className="space-y-2">
            {analysis.stats.map(stat => {
              const maxSets = analysis.stats[0]
                ? analysis.stats[0].primarySets + analysis.stats[0].secondarySets
                : 1;
              return (
                <button
                  key={stat.id}
                  type="button"
                  data-testid="muscle-bar"
                  onClick={() => setSelected(stat)}
                  className="w-full text-left rounded-md -mx-1 px-1 py-0.5 hover:bg-accent/50 transition-colors"
                >
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
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Exercises for the tapped muscle group */}
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent data-testid="muscle-exercises">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>
              Oefeningen in dit schema die deze spiergroep trainen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {selectedExercises.primary.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Primair</p>
                <ul className="space-y-1">
                  {selectedExercises.primary.map((e, i) => (
                    <li key={`p-${i}`} className="flex justify-between text-sm">
                      <span>{e.name}</span>
                      <span className="text-muted-foreground">{e.sets} sets</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedExercises.secondary.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Secundair</p>
                <ul className="space-y-1">
                  {selectedExercises.secondary.map((e, i) => (
                    <li key={`s-${i}`} className="flex justify-between text-sm">
                      <span>{e.name}</span>
                      <span className="text-muted-foreground">{e.sets} sets</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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

  // Exercises across all days (for the "Totaal" scope).
  const totalExercises = useMemo(
    () => (schema ? getAllSchemaExercises(schema) : []),
    [schema],
  );

  // Estimated total training time (rest + work + transitions).
  const totalEstimate = useMemo(
    () => estimateExercisesSeconds(totalExercises, exerciseMap, settings),
    [totalExercises, exerciseMap, settings],
  );

  // Analysis for total schema (all exercises across all days)
  const totalAnalysis = useMemo(() => {
    if (!schema) return { stats: [], missing: [], totalSets: 0 };
    return computeMuscleAnalysis(totalExercises, exerciseMap, settings.muscleDetailLevel);
  }, [schema, totalExercises, exerciseMap, settings.muscleDetailLevel]);

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

  // Schema sharing via QR/link
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!schema) {
    return (
      <div>
        <PageHeader title="Schema laden..." backTo="/schemas" />
      </div>
    );
  }

  async function openShare() {
    if (!schema) return;
    const names = new Map<number, string>();
    exerciseMap.forEach((ex, id) => names.set(id, ex.name));
    const shared = buildSharedSchema(schema, names);
    const url = encodeSchemaShareUrl(shared, import.meta.env.BASE_URL);
    const { default: QRCode } = await import('qrcode');
    const dataUrl = await QRCode.toDataURL(url, { width: 240, margin: 1 });
    setShareUrl(url);
    setQrDataUrl(dataUrl);
    setCopied(false);
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be unavailable; the link stays selectable in the input
    }
  }

  function renderExerciseList(exercises: SchemaExercise[]) {
    if (exercises.length === 0) {
      return <p className="text-muted-foreground text-sm py-4 text-center">Geen oefeningen.</p>;
    }
    const infos = groupSupersets(exercises);

    const renderCard = (i: number) => {
      const se = exercises[i]!;
      const info = infos[i]!;
      const exercise = exerciseMap.get(se.exerciseId);
      return (
        <Card key={`${se.exerciseId}-${i}`} className="shadow-none">
          <CardContent className="p-3 flex items-center gap-3">
            {info.inSuperset ? (
              <span className="w-5 text-center text-xs font-semibold text-primary">{info.label}</span>
            ) : (
              <span className="text-muted-foreground text-xs w-5 text-center">{i + 1}</span>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">{exercise?.name ?? 'Onbekend'}</span>
              <div className="flex gap-1 mt-1">
                {exercise?.primaryMuscles.map(m => (
                  <MuscleChip key={m} muscleId={m} type="primary" />
                ))}
              </div>
            </div>
            <span className="text-muted-foreground text-xs whitespace-nowrap text-right">
              {se.sets}x{formatReps(se.repsPerSet, se.repsMax)}
              {se.startWeight != null && (
                <span className="block text-[10px]">{se.startWeight} kg</span>
              )}
            </span>
          </CardContent>
        </Card>
      );
    };

    return (
      <div className="space-y-2">
        {supersetBlocks(exercises).map(block => {
          if (block.length === 1) return renderCard(block[0]!);
          return (
            <div
              key={`ss-${exercises[block[0]!]!.supersetGroup}`}
              data-testid="superset-group"
              className="rounded-xl border border-primary/30 bg-primary/5 p-1.5 space-y-2"
            >
              <div className="px-1.5 pt-0.5 flex items-center gap-1 text-[11px] font-medium text-primary">
                <Link2 className="h-3 w-3" /> Superset
              </div>
              {block.map(renderCard)}
            </div>
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
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={openShare}
              aria-label="Schema delen"
            >
              <Share2 className="h-4 w-4" />
              Deel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/schemas/${schema.id}/edit`)}
            >
              <Pencil className="h-4 w-4" />
              Bewerken
            </Button>
          </div>
        }
      />

      {/* Exercise list — single-day or multi-day with tabs */}
      <div className="px-4 py-3">
        {multiDay ? (
          <>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              {sortedDays.length} dagen | {getAllSchemaExercises(schema).length} oefeningen totaal | {formatEstimatedTime(totalEstimate)}
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
                    {day.exercises.reduce((sum, e) => sum + e.sets, 0)} sets |{' '}
                    {formatEstimatedTime(estimateExercisesSeconds(day.exercises, exerciseMap, settings))}
                  </p>
                  {renderExerciseList(day.exercises)}
                </TabsContent>
              ))}
            </Tabs>
          </>
        ) : (
          <>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              Oefeningen ({schema.exercises.length}){schema.exercises.length > 0 ? ` | ${formatEstimatedTime(totalEstimate)}` : ''}
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
            <MuscleStatsSection analysis={totalAnalysis} allExercises={allExercises} exercises={totalExercises} exerciseMap={exerciseMap} />
          </TabsContent>
          {sortedDays.map(day => {
            const dayAnalysis = dayAnalyses.get(day.id);
            if (!dayAnalysis) return null;
            return (
              <TabsContent key={day.id} value={day.id}>
                <MuscleStatsSection analysis={dayAnalysis} allExercises={allExercises} exercises={day.exercises} exerciseMap={exerciseMap} />
              </TabsContent>
            );
          })}
        </Tabs>
      ) : (
        <MuscleStatsSection analysis={totalAnalysis} allExercises={allExercises} exercises={totalExercises} exerciseMap={exerciseMap} />
      )}

      {/* Share via QR / link */}
      <Dialog open={shareUrl !== null} onOpenChange={(open) => { if (!open) { setShareUrl(null); setQrDataUrl(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schema delen</DialogTitle>
            <DialogDescription>
              Scan de QR-code met de camera van je andere apparaat, of kopieer de link.
              Het schema wordt daar toegevoegd.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="QR-code om dit schema te importeren"
                className="rounded-lg bg-white p-2"
                width={240}
                height={240}
              />
            )}
            <div className="flex w-full items-center gap-2">
              <Input
                readOnly
                value={shareUrl ?? ''}
                onFocus={e => e.currentTarget.select()}
                className="text-xs"
              />
              <Button variant="secondary" size="icon" onClick={copyShareUrl} aria-label="Link kopiëren">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
