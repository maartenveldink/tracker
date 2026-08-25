import { useMemo, useState } from 'react';
import { formatDurationLong } from '../../../lib/utils';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useWorkout } from '../hooks/useWorkout';
import { useExercises } from '../hooks/useExercises';
import { useCompletedWorkouts, calculate1RM, deleteWorkout } from '../hooks/useProgress';
import { calculateStreak, volumePerMuscleGroup } from '../lib/metrics';
import { improvedExercises } from '../lib/progression';
import { useSettings } from '../../../hooks/useSettings';
import { MuscleVolumeBars } from '../components/MuscleVolumeBars';
import { CelebrationBurst } from '../components/CelebrationBurst';
import { getMuscleGroupById } from '../db/muscles';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { PageHeader } from '../../../components/PageHeader';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { X, Clock, Layers, Weight, ArrowRight, Share2, Image as ImageIcon, Trash2, FileText, TrendingUp } from 'lucide-react';
import { shareText, shareImage, svgToPngBlob } from '../../../lib/share';
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

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Rows describing one exercise on the share card. */
interface CardExerciseRow {
  name: string;
  sets: string;
  isPR: boolean;
}

/** Builds a shareable summary card as a detached SVG element (dark theme). */
function buildSummarySvg(data: {
  title: string;
  date: string;
  duration: string;
  sets: number;
  volume: number;
  streak: number | null;
  exercises: CardExerciseRow[];
  muscles: Array<{ name: string; volume: number }>;
}): SVGSVGElement {
  const width = 640;
  const pad = 40;
  const bg = '#0f172a';
  const card = '#1e293b';
  const track = '#334155';
  const text = '#f1f5f9';
  const muted = '#94a3b8';
  const accent = '#38bdf8';
  const amber = '#fbbf24';

  const parts: string[] = [];
  let y = pad + 10;

  // Header
  parts.push(
    `<text x="${pad}" y="${y}" fill="${text}" font-size="30" font-weight="700" font-family="system-ui, sans-serif">${escapeXml(truncate(data.title, 34))}</text>`,
  );
  y += 30;
  parts.push(
    `<text x="${pad}" y="${y}" fill="${muted}" font-size="17" font-family="system-ui, sans-serif">${escapeXml(data.date)}</text>`,
  );
  y += 34;

  if (data.streak && data.streak >= 2) {
    parts.push(
      `<text x="${pad}" y="${y}" fill="${amber}" font-size="16" font-weight="600" font-family="system-ui, sans-serif">${escapeXml(`\u{1F525} ${data.streak} weken op rij`)}</text>`,
    );
    y += 28;
  }

  // Stat boxes
  const boxTop = y;
  const boxH = 78;
  const gap = 16;
  const boxW = (width - pad * 2 - gap * 2) / 3;
  const stats: Array<[string, string]> = [
    [data.duration, 'Duur'],
    [String(data.sets), 'Sets'],
    [data.volume > 0 ? String(Math.round(data.volume)) : '-', 'Volume (kg)'],
  ];
  stats.forEach(([value, label], i) => {
    const bx = pad + i * (boxW + gap);
    parts.push(
      `<rect x="${bx}" y="${boxTop}" width="${boxW}" height="${boxH}" rx="12" fill="${card}"/>`,
      `<text x="${bx + boxW / 2}" y="${boxTop + 36}" fill="${text}" font-size="24" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">${escapeXml(truncate(value, 10))}</text>`,
      `<text x="${bx + boxW / 2}" y="${boxTop + 60}" fill="${muted}" font-size="14" text-anchor="middle" font-family="system-ui, sans-serif">${escapeXml(label)}</text>`,
    );
  });
  y = boxTop + boxH + 40;

  // Exercises
  parts.push(
    `<text x="${pad}" y="${y}" fill="${muted}" font-size="14" font-weight="600" letter-spacing="1" font-family="system-ui, sans-serif">OEFENINGEN</text>`,
  );
  y += 30;

  for (const ex of data.exercises) {
    parts.push(
      `<text x="${pad}" y="${y}" fill="${text}" font-size="18" font-weight="600" font-family="system-ui, sans-serif">${escapeXml(truncate(ex.name, 40))}${ex.isPR ? ` <tspan fill="${amber}" font-size="14" font-weight="700">PR</tspan>` : ''}</text>`,
    );
    y += 24;
    parts.push(
      `<text x="${pad}" y="${y}" fill="${muted}" font-size="15" font-family="system-ui, sans-serif">${escapeXml(truncate(ex.sets, 58))}</text>`,
    );
    y += 32;
  }

  // Volume per muscle group
  if (data.muscles.length > 0) {
    y += 12;
    parts.push(
      `<text x="${pad}" y="${y}" fill="${muted}" font-size="14" font-weight="600" letter-spacing="1" font-family="system-ui, sans-serif">VOLUME PER SPIERGROEP</text>`,
    );
    y += 26;
    const barW = width - pad * 2;
    const maxVol = Math.max(...data.muscles.map(m => m.volume), 1);
    for (const m of data.muscles) {
      parts.push(
        `<text x="${pad}" y="${y}" fill="${text}" font-size="15" font-family="system-ui, sans-serif">${escapeXml(truncate(m.name, 36))}</text>`,
        `<text x="${width - pad}" y="${y}" fill="${muted}" font-size="14" text-anchor="end" font-family="system-ui, sans-serif">${Math.round(m.volume)} kg</text>`,
      );
      const trackY = y + 8;
      const fillW = Math.max(6, (m.volume / maxVol) * barW);
      parts.push(
        `<rect x="${pad}" y="${trackY}" width="${barW}" height="8" rx="4" fill="${track}"/>`,
        `<rect x="${pad}" y="${trackY}" width="${fillW}" height="8" rx="4" fill="${accent}"/>`,
      );
      y = trackY + 8 + 24;
    }
  }

  y += 8;
  parts.push(
    `<text x="${pad}" y="${y}" fill="${accent}" font-size="14" font-weight="600" font-family="system-ui, sans-serif">Tracker</text>`,
  );
  const height = y + pad - 20;

  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${bg}"/>` +
    parts.join('') +
    `</svg>`;

  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  return doc.documentElement as unknown as SVGSVGElement;
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
  const [showDelete, setShowDelete] = useState(false);
  const [showShare, setShowShare] = useState(false);

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

  // Feature 4: exercises that improved over the previous session (1RM up), but
  // are not an all-time PR. PR takes precedence over this lighter status.
  const improvedExerciseIds = useMemo(() => {
    if (!workout) return new Set<number>();
    return improvedExercises(workout, completedWorkouts, settings.oneRMFormula);
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

  const volumeDiff = volumeComparison.previous !== null
    ? Math.round(volumeComparison.current - volumeComparison.previous)
    : null;

  async function shareSummary() {
    if (!workout) return;
    const title = `${workout.schemaName ?? 'Vrije training'}${workout.schemaDayName ? ` - ${workout.schemaDayName}` : ''}`;
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

  async function shareSummaryImage() {
    if (!workout) return;
    const title = `${workout.schemaName ?? 'Vrije training'}${workout.schemaDayName ? ` - ${workout.schemaDayName}` : ''}`;
    const exercises: CardExerciseRow[] = [];
    for (const we of workout.exercises) {
      const done = we.sets.filter(s => s.completed);
      if (done.length === 0) continue;
      exercises.push({
        name: exerciseMap.get(we.exerciseId)?.name ?? 'Onbekend',
        sets: done.map(s => `${s.weight ?? 0}×${s.actualReps ?? 0}`).join(', '),
        isPR: prExercises.has(we.exerciseId),
      });
    }
    const muscles = Array.from(muscleVolume.entries())
      .map(([id, vol]) => ({ name: getMuscleGroupById(id)?.name ?? id, volume: vol }))
      .sort((a, b) => b.volume - a.volume);
    const svg = buildSummarySvg({
      title,
      date: formatDate(workout.startedAt),
      duration: formatDurationLong(duration),
      sets: totalSetsCompleted,
      volume: totalVolume,
      streak,
      exercises,
      muscles,
    });
    const blob = await svgToPngBlob(svg, { scale: 2, background: '#0f172a' });
    await shareImage(blob, 'training.png', title);
  }

  async function handleDelete() {
    if (workoutId === undefined) return;
    await deleteWorkout(workoutId);
    setShowDelete(false);
    navigate(closeTo);
  }

  return (
    <div className="min-h-screen">
      <CelebrationBurst play={prExercises.size > 0 || improvedExerciseIds.size > 0} />
      <PageHeader
        title="Samenvatting"
        actions={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowShare(true)}
              aria-label="Delen"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setShowDelete(true)}
              aria-label="Training verwijderen"
            >
              <Trash2 className="h-4 w-4" />
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
          {workout.schemaName ?? 'Vrije training'}
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
            const isImproved = !isPR && improvedExerciseIds.has(we.exerciseId);

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
                    {/* Feature 4: progression vs previous session */}
                    {isImproved && (
                      <span className="text-xs text-emerald-400 font-medium inline-flex items-center gap-0.5">
                        <TrendingUp className="h-3.5 w-3.5" /> Vooruitgang
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
      {muscleVolume.size > 0 && (
        <>
          <Separator />
          <div className="px-4 py-3">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Volume per spiergroep</h3>
            <MuscleVolumeBars volume={muscleVolume} />
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

      <Sheet open={showShare} onOpenChange={setShowShare}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Training delen</SheetTitle>
            <SheetDescription>Kies hoe je deze samenvatting wilt delen.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => { setShowShare(false); shareSummary(); }}
            >
              <FileText className="h-6 w-6" />
              Tekst
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => { setShowShare(false); shareSummaryImage(); }}
            >
              <ImageIcon className="h-6 w-6" />
              Afbeelding
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={showDelete}
        title="Training verwijderen?"
        message="Weet je zeker dat je deze training wilt verwijderen? Dit kan niet ongedaan worden gemaakt."
        confirmLabel="Verwijderen"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
