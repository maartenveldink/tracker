import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Trash2, Pencil, Share2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { useExercises } from '../hooks/useExercises';
import {
  useProgress,
  useCompletedWorkouts,
  computeExerciseSessions,
  useExercisesWithLastSession,
  deleteWorkout,
  filterByPeriod,
  type PeriodFilter,
} from '../hooks/useProgress';
import { useSettings } from '../../../hooks/useSettings';
import { PageHeader } from '../../../components/PageHeader';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { shareText, svgToPngBlob, shareImage } from '../../../lib/share';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { BodyWeightSection } from '../components/BodyWeightSection';
import { RecordsBoard } from '../components/RecordsBoard';

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: '4w', label: '4 weken' },
  { value: '3m', label: '3 maanden' },
  { value: 'all', label: 'Alles' },
];

function formatDate(date: Date): string {
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRelative(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return 'Vandaag';
  if (days === 1) return 'Gisteren';
  if (days < 7) return `${days} dagen geleden`;
  if (days < 30) return `${Math.floor(days / 7)} wk geleden`;
  if (days < 365) return `${Math.floor(days / 30)} mnd geleden`;
  return `${Math.floor(days / 365)} jr geleden`;
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

// ── List view ────────────────────────────────────────────────────────────────

function ExerciseList({ onSelect }: { onSelect: (id: number) => void }) {
  const exercises = useExercises();
  const withSessions = useExercisesWithLastSession();

  const exerciseMap = useMemo(
    () => new Map(exercises.map(e => [e.id!, e.name])),
    [exercises],
  );

  if (withSessions.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-muted-foreground text-sm">
        Nog geen gelogde trainingen. Start een training om je voortgang bij te houden.
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2">
      {withSessions.map(({ id, lastSessionAt }) => {
        const name = exerciseMap.get(id);
        if (!name) return null;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="w-full text-left"
          >
            <Card className="hover:bg-accent/40 transition-colors">
              <CardContent className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="font-medium text-sm truncate">{name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatRelative(lastSessionAt)}
                </span>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

// ── Detail view ──────────────────────────────────────────────────────────────

function ExerciseDetail({
  exerciseId,
  exerciseName,
  onBack,
}: {
  exerciseId: number;
  exerciseName: string;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodFilter>('3m');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; date: Date } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const settings = useSettings();
  const formula = settings.oneRMFormula;
  const sessions = useProgress(exerciseId, formula);
  const filteredSessions = useMemo(() => filterByPeriod(sessions, period), [sessions, period]);

  async function shareChart() {
    const svg = chartRef.current?.querySelector('svg');
    const latest = sessions[sessions.length - 1];
    const caption = latest
      ? `Progressie ${exerciseName} — beste 1RM ~${Math.round(latest.best1RM)} kg`
      : `Progressie ${exerciseName}`;
    if (!svg) {
      await shareText(caption, caption);
      return;
    }
    try {
      const cardVar = getComputedStyle(document.documentElement).getPropertyValue('--card').trim();
      const blob = await svgToPngBlob(svg as SVGSVGElement, {
        background: cardVar ? `hsl(${cardVar})` : '#0f172a',
      });
      await shareImage(blob, `progressie-${exerciseName}.png`, caption);
    } catch {
      await shareText(caption, caption);
    }
  }

  const chartData = useMemo(
    () =>
      filteredSessions.map(s => ({
        date: formatShortDate(s.date),
        '1RM': Math.round(s.best1RM * 10) / 10,
      })),
    [filteredSessions],
  );

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteWorkout(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <div>
      {/* Back header */}
      <div className="flex items-center gap-1 px-2 pt-3 pb-1">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Terug">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="font-semibold text-base truncate flex-1">{exerciseName}</h2>
        {sessions.length > 0 && (
          <Button variant="ghost" size="sm" onClick={shareChart} aria-label="Progressie delen">
            <Share2 className="h-4 w-4" />
            Deel
          </Button>
        )}
      </div>

      <Separator />

      {sessions.length === 0 ? (
        <div className="px-4 py-12 text-center text-muted-foreground text-sm">
          Nog geen gelogde sets voor{' '}
          <span className="font-medium text-foreground">{exerciseName}</span>.
        </div>
      ) : (
        <>
          {/* Period filter */}
          <div className="px-4 pt-3 pb-2 flex gap-2">
            {PERIOD_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                variant={period === opt.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {/* 1RM chart */}
          {filteredSessions.length > 0 && (
            <div className="px-4 pb-4" ref={chartRef}>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground mb-2">Geschatte 1RM (kg)</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                        unit=" kg"
                        width={55}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="1RM"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Session list */}
          <div className="px-4 space-y-2 pb-4">
            <p className="text-xs text-muted-foreground">
              Sessies ({filteredSessions.length})
            </p>
            {filteredSessions
              .slice()
              .reverse()
              .map(session => (
                <Card key={session.workoutId} className="shadow-none">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{formatDate(session.date)}</span>
                          {session.schemaName && (
                            <span className="text-xs text-muted-foreground truncate">
                              {session.schemaName}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {session.sets.map((s, i) => (
                            <span key={s.setNumber}>
                              {i > 0 && ', '}
                              {s.reps} × {s.weight} kg
                            </span>
                          ))}
                        </p>
                        <p className="text-xs mt-1">
                          <span className="text-primary font-medium">
                            Beste: {session.bestSet.reps} × {session.bestSet.weight} kg
                          </span>
                          <span className="text-muted-foreground">
                            {' '}— 1RM: ~{Math.round(session.best1RM * 10) / 10} kg
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => navigate(`/workout/${session.workoutId}/edit`)}
                          aria-label="Bewerk training"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget({ id: session.workoutId, date: session.date })}
                          aria-label="Verwijder training"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Training verwijderen"
        message={`Weet je zeker dat je de training van ${deleteTarget ? formatDate(deleteTarget.date) : ''} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`}
        confirmLabel="Verwijderen"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ── Comparison view ──────────────────────────────────────────────────────────

const COMPARE_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6'];

function ComparisonView() {
  const workouts = useCompletedWorkouts();
  const withSessions = useExercisesWithLastSession();
  const exercises = useExercises();
  const settings = useSettings();
  const formula = settings.oneRMFormula;

  const [period, setPeriod] = useState<PeriodFilter>('3m');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);

  const nameById = useMemo(
    () => new Map(exercises.map(e => [e.id!, e.name])),
    [exercises],
  );

  // Exercises that actually have logged sessions
  const selectable = useMemo(
    () =>
      withSessions
        .map(({ id }) => ({ id, name: nameById.get(id) }))
        .filter((e): e is { id: number; name: string } => Boolean(e.name)),
    [withSessions, nameById],
  );

  function toggle(id: number) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }

  // Build combined chart data: % of each exercise's first 1RM in the period
  const { data, lines } = useMemo(() => {
    const series = selectedIds.map((id, i) => {
      const s = filterByPeriod(computeExerciseSessions(workouts, id, formula), period);
      const baseline = s[0]?.best1RM ?? 0;
      return {
        name: nameById.get(id) ?? '?',
        color: COMPARE_COLORS[i % COMPARE_COLORS.length]!,
        points: s.map(x => ({
          t: x.date.getTime(),
          pct: baseline > 0 ? Math.round((x.best1RM / baseline) * 1000) / 10 : 100,
        })),
      };
    });

    const allTs = Array.from(new Set(series.flatMap(x => x.points.map(p => p.t)))).sort(
      (a, b) => a - b,
    );
    const rows = allTs.map(t => {
      const row: Record<string, string | number | null> = { date: formatShortDate(new Date(t)) };
      for (const x of series) {
        const p = x.points.find(pt => pt.t === t);
        row[x.name] = p ? p.pct : null;
      }
      return row;
    });

    return { data: rows, lines: series.map(x => ({ name: x.name, color: x.color })) };
  }, [selectedIds, workouts, formula, period, nameById]);

  async function shareChart() {
    const svg = chartRef.current?.querySelector('svg');
    const caption = `1RM-vergelijking (${lines.map(l => l.name).join(', ')})`;
    if (!svg) {
      await shareText(caption, caption);
      return;
    }
    try {
      const cardVar = getComputedStyle(document.documentElement).getPropertyValue('--card').trim();
      const blob = await svgToPngBlob(svg as SVGSVGElement, {
        background: cardVar ? `hsl(${cardVar})` : '#0f172a',
      });
      await shareImage(blob, 'progressie-vergelijking.png', caption);
    } catch {
      await shareText(caption, caption);
    }
  }

  if (selectable.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-muted-foreground text-sm">
        Nog geen gelogde trainingen om te vergelijken.
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-4">
      {/* Period filter */}
      <div className="flex gap-2">
        {PERIOD_OPTIONS.map(opt => (
          <Button
            key={opt.value}
            variant={period === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Exercise multi-select */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Kies oefeningen om te vergelijken:</p>
        <div className="flex flex-wrap gap-1.5">
          {selectable.map(({ id, name }) => {
            const idx = selectedIds.indexOf(id);
            const selected = idx >= 0;
            const color = selected ? COMPARE_COLORS[idx % COMPARE_COLORS.length] : undefined;
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  selected
                    ? 'text-white border-transparent'
                    : 'bg-secondary text-muted-foreground border-border hover:bg-accent',
                )}
                style={selected ? { backgroundColor: color } : undefined}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      {selectedIds.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">
          Selecteer één of meer oefeningen hierboven.
        </p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">
          Geen sessies in deze periode.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Procentuele 1RM-progressie (start = 100%)</p>
            <Button variant="ghost" size="sm" onClick={shareChart} aria-label="Vergelijking delen">
              <Share2 className="h-4 w-4" />
              Deel
            </Button>
          </div>
          <div ref={chartRef}>
            <Card>
              <CardContent className="p-3">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      unit="%"
                      width={45}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '12px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value) => [`${value}%`, '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <ReferenceLine y={100} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                    {lines.map(l => (
                      <Line
                        key={l.name}
                        type="monotone"
                        dataKey={l.name}
                        stroke={l.color}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type ProgressMode = 'single' | 'compare' | 'records' | 'bodyweight';

const MODE_OPTIONS: { value: ProgressMode; label: string }[] = [
  { value: 'single', label: 'Per oefening' },
  { value: 'compare', label: 'Vergelijken' },
  { value: 'records', label: 'Records' },
  { value: 'bodyweight', label: 'Gewicht' },
];

export function ProgressPage() {
  const exercises = useExercises();
  const [selectedId, setSelectedId] = useState<number | undefined>();
  const [mode, setMode] = useState<ProgressMode>('single');

  const selectedExercise = useMemo(
    () => exercises.find(e => e.id === selectedId),
    [exercises, selectedId],
  );

  // A specific exercise is open — show its detail without the mode switcher
  if (mode === 'single' && selectedId && selectedExercise) {
    return (
      <div>
        <PageHeader title="Progressie" />
        <ExerciseDetail
          exerciseId={selectedId}
          exerciseName={selectedExercise.name}
          onBack={() => setSelectedId(undefined)}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Progressie" />

      {/* Mode switcher */}
      <div className="px-4 pt-3 overflow-x-auto">
        <div className="inline-flex rounded-lg border border-border p-0.5 bg-secondary/50">
          {MODE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                mode === opt.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'single' && <ExerciseList onSelect={setSelectedId} />}
      {mode === 'compare' && <ComparisonView />}
      {mode === 'records' && (
        <RecordsBoard onSelect={id => { setSelectedId(id); setMode('single'); }} />
      )}
      {mode === 'bodyweight' && <BodyWeightSection />}
    </div>
  );
}
