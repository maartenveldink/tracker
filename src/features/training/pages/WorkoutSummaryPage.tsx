import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn, formatDurationLong } from '../../../lib/utils';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useWorkout } from '../hooks/useWorkout';
import { useExerciseLookup } from '../hooks/useExercises';
import { useCompletedWorkoutsQuery, deleteWorkout } from '../hooks/useProgress';
import { calculateStreak, getISOWeek, statsForWeek, volumePerMuscleGroup } from '../lib/metrics';
import { isCompletedSet } from '../lib/sets';
import {
  hasSomethingToCelebrate,
  shouldPlayArrivalCelebration,
  summarizeWorkout,
  summaryHeadline,
  type ExerciseResult,
} from '../lib/workoutSummary';
import { formatDecimal } from '../lib/liveTraining';
import { useSettingsState } from '../../../hooks/useSettings';
import { MuscleVolumeBars } from '../components/MuscleVolumeBars';
import { CelebrationEffects, prefersReducedMotion } from '../components/CelebrationEffects';
import { momentSubline } from '../components/ExerciseMoment';
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
import { StatTile } from '@/components/ui/stat-tile';
import { X, ArrowRight, Share2, Image as ImageIcon, Trash2, FileText, TrendingUp, Trophy, Flame } from 'lucide-react';
import { shareText, shareImage, svgToPngBlob } from '../../../lib/share';

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

/** "82,5" (one decimal at most, Dutch comma). */
function kg(n: number): string {
  return formatDecimal(Math.round(n * 10) / 10);
}

/** "+2,5" / "−1" / "±0" for a kg difference. */
function signedKg(n: number): string {
  const r = Math.round(n * 10) / 10;
  if (r === 0) return '±0';
  return `${r > 0 ? '+' : '−'}${formatDecimal(Math.abs(r))}`;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-caption font-semibold uppercase tracking-[0.08em] text-muted">{children}</h3>
  );
}

/** One success moment: a new PR and/or better than last time, with the difference. */
function HighlightRow({ result, name }: { result: ExerciseResult; name: string }) {
  const c = result.comparison;
  return (
    <li className="rounded-row border bg-surface px-4 py-3" data-testid="summary-highlight">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="min-w-0 break-words text-body font-semibold">{name}</p>
        {result.isPR ? (
          <span className="inline-flex items-center gap-1 rounded-chip bg-accent px-2 py-0.5 text-caption font-semibold text-on-accent">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            Persoonlijk record!
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-chip border border-accent-2 px-2 py-0.5 text-caption font-semibold text-accent-2">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
            Vooruitgang
          </span>
        )}
      </div>
      {result.isPR && result.previousBest1RM !== null && (
        <p className="mt-1 text-small text-text">
          Geschat 1RM {kg(result.best1RM)} kg{' '}
          <span className="text-accent-2">({signedKg(result.best1RM - result.previousBest1RM)} kg op je vorige record)</span>
        </p>
      )}
      {c && c.improved && (
        <>
          <p className="mt-1 text-small text-text">
            Gem. 1RM {kg(c.previousAvg)} → {kg(c.todayAvg)} kg{' '}
            <span className="text-accent-2">({c.todayAvg - c.previousAvg < 0.05 ? '+<0,1' : signedKg(c.todayAvg - c.previousAvg)} kg)</span>
          </p>
          <p className="text-caption text-muted">{momentSubline(c)} t.o.v. vorige keer</p>
        </>
      )}
    </li>
  );
}

/** Neutral comparison line on an exercise card: what changed vs last time, also when it went down. */
function ComparisonLine({ result }: { result: ExerciseResult }) {
  const c = result.comparison;
  if (!c) {
    return result.best1RM > 0 ? (
      <p className="mt-2 text-caption text-muted">Nog geen vorige sessie om mee te vergelijken.</p>
    ) : null;
  }
  // Same strict rule as "better than last time", so the card never contradicts the highlights.
  const word = c.improved ? 'hoger dan' : c.todayAvg === c.previousAvg ? 'gelijk aan' : 'lager dan';
  return (
    <p className="mt-2 text-caption text-muted">
      Gem. 1RM {kg(c.todayAvg)} kg, {word} vorige keer ({kg(c.previousAvg)} kg)
    </p>
  );
}

export function WorkoutSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const workoutId = id || undefined;
  const workout = useWorkout(workoutId);
  const { byId: exerciseMap, nameOf } = useExerciseLookup();
  const historyQuery = useCompletedWorkoutsQuery();
  const completedWorkouts = useMemo(() => historyQuery ?? [], [historyQuery]);
  const { settings, loaded: settingsLoaded } = useSettingsState();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { from?: string; justFinished?: boolean } | null;
  const closeTo = navState?.from ?? '/start';
  const [showDelete, setShowDelete] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [celebrateNonce, setCelebrateNonce] = useState(0);
  const arrivalHandled = useRef(false);
  // Read the "just finished" flag once and clear it from history right away, so
  // a reload or back/forward never replays the effects (even before data loads).
  const arrivedJustFinished = useRef(navState?.justFinished === true);
  useEffect(() => {
    if (navState?.justFinished) {
      navigate(location.pathname, { replace: true, state: navState.from ? { from: navState.from } : null });
    }
  }, [navState, navigate, location.pathname]);

  // Volume per muscle group (E3-08)
  const muscleVolume = useMemo(
    () => (workout ? volumePerMuscleGroup([workout], exerciseMap) : new Map<string, number>()),
    [workout, exerciseMap],
  );

  // PRs, "better than last time" and volume delta, compared with earlier workouts only.
  const summary = useMemo(
    () => (workout ? summarizeWorkout(workout, completedWorkouts, settings.oneRMFormula) : null),
    [workout, completedWorkouts, settings.oneRMFormula],
  );

  // Streak and week count as they were at this workout (not counting later ones).
  const upToThis = useMemo(
    () => (workout ? completedWorkouts.filter(w => w.startedAt.getTime() <= workout.startedAt.getTime()) : []),
    [completedWorkouts, workout],
  );
  const streak = useMemo(() => calculateStreak(upToThis), [upToThis]);

  // Arrival celebration: the same fireworks + vibration as the live "Oefening
  // klaar" moment, once, right after finishing (router flag `justFinished`, set
  // by the live workout) and only when there is something to celebrate. The flag
  // is cleared afterwards so a reload or back/forward never replays it.
  useEffect(() => {
    if (arrivalHandled.current) return;
    if (!workout || !summary || historyQuery === undefined || !settingsLoaded) return;
    arrivalHandled.current = true;
    if (!arrivedJustFinished.current) return;
    if (!settings.celebrationEnabled || !hasSomethingToCelebrate(summary)) return;
    if (!shouldPlayArrivalCelebration({ justFinished: true, completedAt: workout.completedAt, now: new Date() })) return;
    setCelebrateNonce(n => n + 1);
    if (settings.celebrationVibrate && !prefersReducedMotion() && typeof navigator.vibrate === 'function') {
      navigator.vibrate([20, 40, 20]);
    }
  }, [workout, summary, historyQuery, settingsLoaded, settings]);

  if (!workout || !summary) {
    return (
      <div>
        <PageHeader title="Laden..." backTo="/start" />
      </div>
    );
  }

  const duration = workout.completedAt
    ? workout.completedAt.getTime() - workout.startedAt.getTime() - workout.totalPausedMs
    : 0;

  const totalSetsCompleted = summary.totalSets;
  const totalVolume = summary.volume;
  const headline = summaryHeadline(summary);
  const prIds = new Set(summary.exercises.filter(e => e.isPR).map(e => e.exerciseId));
  // PRs first, then the other "better than last time" exercises.
  const highlights = summary.exercises
    .filter(e => e.isPR || e.improved)
    .sort((a, b) => Number(b.isPR) - Number(a.isPR) || a.index - b.index);
  const inCurrentWeek = getISOWeek(workout.startedAt) === getISOWeek(new Date());
  const sessionsThisWeek = inCurrentWeek ? statsForWeek(upToThis, workout.startedAt).sessions : 0;
  const title = `${workout.schemaName ?? 'Vrije training'}${workout.schemaDayName ? ` - ${workout.schemaDayName}` : ''}`;

  async function shareSummary() {
    if (!workout) return;
    const lines: string[] = [
      `🏋️ ${title} — ${formatDate(workout.startedAt)}`,
      `⏱️ ${formatDurationLong(duration)} · ${totalSetsCompleted} sets · ${Math.round(totalVolume)} kg volume`,
      '',
    ];
    for (const we of workout.exercises) {
      const done = we.sets.filter(s => s.completed);
      if (done.length === 0) continue;
      const setsText = done.map(s => `${s.weight ?? 0}×${s.actualReps ?? 0}`).join(', ');
      const pr = prIds.has(we.exerciseId) ? ' 🏆' : '';
      lines.push(`• ${nameOf(we.exerciseId)}: ${setsText}${pr}`);
    }
    await shareText(lines.join('\n'), title);
  }

  async function shareSummaryImage() {
    if (!workout) return;
    const exercises: CardExerciseRow[] = [];
    for (const we of workout.exercises) {
      const done = we.sets.filter(s => s.completed);
      if (done.length === 0) continue;
      exercises.push({
        name: nameOf(we.exerciseId),
        sets: done.map(s => `${s.weight ?? 0}×${s.actualReps ?? 0}`).join(', '),
        isPR: prIds.has(we.exerciseId),
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

  const volumeDelta = summary.volumeDelta;

  return (
    <div className="mx-auto min-h-screen w-full max-w-column">
      <CelebrationEffects key={celebrateNonce} play={celebrateNonce > 0} />
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
              className="text-muted hover:text-danger"
              onClick={() => setShowDelete(true)}
              aria-label="Training verwijderen"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(closeTo)}
              aria-label="Sluiten"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        }
      />

      {/* Hero: training done, what you did, and the headline of how it went */}
      <section aria-label="Training klaar" className="flex flex-col gap-3 px-4 pt-4">
        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.08em] text-muted">Training klaar</p>
          <h2 className="break-words font-display text-title font-bold">
            {workout.schemaName ?? 'Vrije training'}
            {workout.schemaDayName && (
              <span className="font-normal text-muted"> - {workout.schemaDayName}</span>
            )}
          </h2>
          <p className="text-small text-muted">
            {formatDate(workout.startedAt)} · {formatTime(workout.startedAt)} -{' '}
            {workout.completedAt ? formatTime(workout.completedAt) : '?'}
          </p>
        </div>

        <div
          data-testid="summary-headline"
          className={cn(
            'flex flex-col items-center gap-1 rounded-card px-4 py-4 text-center',
            headline.celebrate ? 'bg-accent text-on-accent' : 'border bg-surface text-text',
          )}
        >
          <span className="font-display text-hero font-bold leading-tight">{headline.title}</span>
          <span className={cn('text-small font-semibold', !headline.celebrate && 'font-normal text-muted')}>
            {headline.subline}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-gap">
          <StatTile className="min-w-0 break-words" label="Duur" value={formatDurationLong(duration)} />
          <StatTile className="min-w-0 break-words" label="Sets" value={totalSetsCompleted} />
          <StatTile className="min-w-0 break-words" label="Volume (kg)" value={totalVolume > 0 ? `${Math.round(totalVolume)}` : '-'} />
        </div>

        {volumeDelta !== null && (
          <p className="text-small text-text">
            Volume <span className="font-semibold text-accent-2">{signedKg(volumeDelta)} kg</span>{' '}
            <span className="text-muted">t.o.v. vorige keer van dit schema</span>
          </p>
        )}

        {(streak >= 2 || sessionsThisWeek > 0) && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-text">
            <Flame className="h-4 w-4 text-accent" aria-hidden="true" />
            {streak >= 2 && <span>{streak} weken op rij getraind</span>}
            {streak >= 2 && sessionsThisWeek > 0 && <span aria-hidden="true" className="text-muted">·</span>}
            {sessionsThisWeek > 0 && <span>{sessionsThisWeek}e training deze week</span>}
          </p>
        )}
      </section>

      {/* Success moments: PRs and exercises better than last time */}
      {highlights.length > 0 && (
        <section aria-label="Hoogtepunten" className="px-4 pt-6">
          <SectionTitle>Hoogtepunten</SectionTitle>
          <ul className="flex flex-col gap-2">
            {highlights.map(r => (
              <HighlightRow key={`${r.exerciseId}-${r.index}`} result={r} name={nameOf(r.exerciseId)} />
            ))}
          </ul>
        </section>
      )}

      {/* Details per exercise: sets, notes and the neutral comparison */}
      <section aria-label="Oefeningen" className="px-4 pt-6">
        <SectionTitle>Oefeningen</SectionTitle>
        <div className="space-y-3">
          {workout.exercises.map((we, idx) => {
            const completedSets = we.sets.filter(isCompletedSet);
            const result = summary.exercises[idx];

            return (
              <Card key={`${we.exerciseId}-${idx}`} className="shadow-none">
                <CardContent className="p-4">
                  <h4 className="mb-1 break-words text-body font-semibold">{nameOf(we.exerciseId)}</h4>
                  {completedSets.length > 0 ? (
                    <div className="space-y-0.5">
                      {completedSets.map((set) => (
                        <div key={set.setNumber} className="flex gap-3 text-small">
                          <span className="w-12 shrink-0 text-muted">Set {set.setNumber}</span>
                          <span>{formatDecimal(set.weight ?? 0)} kg × {set.actualReps ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-caption text-muted">Geen sets voltooid</p>
                  )}
                  {result && <ComparisonLine result={result} />}
                  {we.notes && (
                    <p className="mt-1 break-words text-caption italic text-muted">{we.notes}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Volume per muscle group (E3-08) */}
      {muscleVolume.size > 0 && (
        <section className="px-4 pt-6">
          <SectionTitle>Volume per spiergroep</SectionTitle>
          <MuscleVolumeBars volume={muscleVolume} />
        </section>
      )}

      {/* Workout notes */}
      {workout.notes && (
        <section className="px-4 pt-6">
          <SectionTitle>Trainingsnotities</SectionTitle>
          <p className="break-words text-small text-text">{workout.notes}</p>
        </section>
      )}

      {/* Share + next session */}
      <div className="flex flex-col gap-3 px-4 pb-8 pt-6">
        <Button variant="outline" className="w-full" onClick={() => setShowShare(true)}>
          <Share2 className="h-4 w-4" />
          Training delen
        </Button>
        <Button
          size="lg"
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
