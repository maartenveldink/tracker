import { useMemo } from 'react';
import { formatDurationLong } from '../../../lib/utils';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useWorkout } from '../hooks/useWorkout';
import { useExercises } from '../hooks/useExercises';
import { useCompletedWorkouts, calculate1RM } from '../hooks/useProgress';
import { calculateStreak, volumePerMuscleGroup } from '../lib/metrics';
import { useSettings } from '../../../hooks/useSettings';
import { MuscleVolumeBars } from '../components/MuscleVolumeBars';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { X, Clock, Layers, Weight, ArrowRight, Share2, Image as ImageIcon } from 'lucide-react';
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
}): SVGSVGElement {
  const width = 640;
  const pad = 40;
  const bg = '#0f172a';
  const card = '#1e293b';
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
    const svg = buildSummarySvg({
      title,
      date: formatDate(workout.startedAt),
      duration: formatDurationLong(duration),
      sets: totalSetsCompleted,
      volume: totalVolume,
      streak,
      exercises,
    });
    const blob = await svgToPngBlob(svg, { scale: 2, background: '#0f172a' });
    await shareImage(blob, 'training.png', title);
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Samenvatting"
        actions={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={shareSummary}>
              <Share2 className="h-4 w-4" />
              Tekst
            </Button>
            <Button variant="ghost" size="sm" onClick={shareSummaryImage}>
              <ImageIcon className="h-4 w-4" />
              Afbeelding
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
    </div>
  );
}
