import { useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Share2, TrendingUp, TrendingDown } from 'lucide-react';
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
  useCompletedWorkouts,
  computeExerciseSessions,
  useExercisesWithLastSession,
  filterByPeriod,
  type PeriodFilter,
} from '../hooks/useProgress';
import { useSettings } from '../../../hooks/useSettings';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { StatTile } from '@/components/ui/stat-tile';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { PeriodChips } from '../components/PeriodChips';
import { WeeklySetsCard } from '../components/WeeklySetsCard';
import { ChartFrame, axisTick, tooltipStyles, useChartColors } from '../components/chartTheme';
import { BodyWeightSection } from '../components/BodyWeightSection';
import { RecordsBoard } from '../components/RecordsBoard';
import { ConsistencyHeatmap } from '../components/ConsistencyHeatmap';
import { TrainingCalendar } from '../components/TrainingCalendar';
import { VolumeTrendChart } from '../components/VolumeTrendChart';
import { ExerciseDetail, shareChartSvg } from '../components/ExerciseDetail';
import { recentTrainingStats } from '../lib/progressInsights';

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

// ── Comparison view ──────────────────────────────────────────────────────────

function ComparisonView() {
  const workouts = useCompletedWorkouts();
  const withSessions = useExercisesWithLastSession();
  const exercises = useExercises();
  const settings = useSettings();
  const formula = settings.oneRMFormula;
  const colors = useChartColors();
  // Series colours: data palette from the tokens (accent, accent-2, text) plus
  // lighter/darker mixes are not designed, so cycle through the three tokens.
  const seriesColors = useMemo(
    () => [colors.accent2, colors.accent, colors.text, colors.muted],
    [colors],
  );

  const [period, setPeriod] = useState<PeriodFilter>('3m');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);

  const nameById = useMemo(
    () => new Map(exercises.map(e => [e.id, e.name])),
    [exercises],
  );

  // Exercises that actually have logged sessions
  const selectable = useMemo(
    () =>
      withSessions
        .map(({ id }) => ({ id, name: nameById.get(id) }))
        .filter((e): e is { id: string; name: string } => Boolean(e.name)),
    [withSessions, nameById],
  );

  function toggle(id: string) {
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
        color: seriesColors[i % seriesColors.length]!,
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
  }, [selectedIds, workouts, formula, period, nameById, seriesColors]);

  async function shareChart() {
    const caption = `1RM-vergelijking (${lines.map(l => l.name).join(', ')})`;
    await shareChartSvg(chartRef.current, caption, 'progressie-vergelijking.png', colors.surface);
  }

  if (selectable.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-small text-muted">
        Nog geen gelogde trainingen om te vergelijken.
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-3">
      <PeriodChips value={period} onChange={setPeriod} />

      {/* Exercise multi-select */}
      <div>
        <p className="mb-2 text-caption text-muted">Kies oefeningen om te vergelijken:</p>
        <div className="flex flex-wrap gap-2">
          {selectable.map(({ id, name }) => (
            <Chip key={id} selected={selectedIds.includes(id)} onClick={() => toggle(id)}>
              {name}
            </Chip>
          ))}
        </div>
      </div>

      {/* Chart */}
      {selectedIds.length === 0 ? (
        <p className="py-8 text-center text-small text-muted">
          Selecteer één of meer oefeningen hierboven.
        </p>
      ) : data.length === 0 ? (
        <p className="py-8 text-center text-small text-muted">Geen sessies in deze periode.</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-caption text-muted">Procentuele 1RM-progressie (start = 100%)</p>
            <Button variant="ghost" size="sm" onClick={shareChart} aria-label="Vergelijking delen">
              <Share2 className="h-4 w-4" />
              Deel
            </Button>
          </div>
          <div ref={chartRef}>
            <Card>
              <CardContent className="p-3">
                <ChartFrame
                  label={`Lijngrafiek: procentuele 1RM-progressie van ${lines.map(l => l.name).join(', ')}`}
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
                      <XAxis dataKey="date" tick={axisTick(colors)} tickLine={false} axisLine={false} />
                      <YAxis tick={axisTick(colors)} tickLine={false} axisLine={false} unit="%" width={45} />
                      <Tooltip {...tooltipStyles(colors)} formatter={value => [`${value}%`, '']} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <ReferenceLine y={100} stroke={colors.muted} strokeDasharray="4 4" />
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
                </ChartFrame>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ── Progression overview ───────────────────────────────────────────────────────

interface ProgressionRow {
  id: string;
  name: string;
  first: number;
  last: number;
  pct: number | null; // null when there aren't ≥2 sessions in the period
  sessions: number;
}

function ProgressionOverview({ onSelect }: { onSelect: (id: string) => void }) {
  const workouts = useCompletedWorkouts();
  const withSessions = useExercisesWithLastSession();
  const exercises = useExercises();
  const settings = useSettings();
  const formula = settings.oneRMFormula;

  const [period, setPeriod] = useState<PeriodFilter>('3m');

  const nameById = useMemo(() => new Map(exercises.map(e => [e.id!, e.name])), [exercises]);

  const rows = useMemo<ProgressionRow[]>(() => {
    const result: ProgressionRow[] = [];
    for (const { id } of withSessions) {
      const name = nameById.get(id);
      if (!name) continue;
      const sessions = filterByPeriod(computeExerciseSessions(workouts, id, formula), period);
      if (sessions.length === 0) continue;
      const first = sessions[0]!.best1RM;
      const last = sessions[sessions.length - 1]!.best1RM;
      const pct =
        sessions.length >= 2 && first > 0 ? Math.round((last / first - 1) * 1000) / 10 : null;
      result.push({ id, name, first, last, pct, sessions: sessions.length });
    }
    // Exercises with a measurable change first (biggest gain on top), then the
    // ones with too little data yet, alphabetically.
    return result.sort((a, b) => {
      if (a.pct === null && b.pct === null) return a.name.localeCompare(b.name);
      if (a.pct === null) return 1;
      if (b.pct === null) return -1;
      return b.pct - a.pct;
    });
  }, [withSessions, nameById, workouts, formula, period]);

  return (
    <div className="space-y-4 px-4 py-3">
      <PeriodChips value={period} onChange={setPeriod} />

      {rows.length === 0 ? (
        <div className="py-12 text-center text-small text-muted">
          Nog geen gelogde oefeningen in deze periode.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const up = row.pct != null && row.pct > 0;
            const down = row.pct != null && row.pct < 0;
            return (
              <button key={row.id} onClick={() => onSelect(row.id)} className="block w-full text-left">
                <Card className="transition-colors hover:bg-line/40">
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-body font-medium">{row.name}</div>
                      <div className="text-caption text-muted">
                        {row.pct === null
                          ? `~${Math.round(row.last)} kg · 1 sessie`
                          : `${Math.round(row.first)} → ${Math.round(row.last)} kg · ${row.sessions} sessies`}
                      </div>
                    </div>
                    {row.pct === null ? (
                      <span className="shrink-0 text-small text-muted">—</span>
                    ) : (
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1 text-small font-semibold tabular-nums',
                          up ? 'text-accent' : 'text-muted',
                        )}
                      >
                        {up && <TrendingUp className="h-4 w-4" />}
                        {down && <TrendingDown className="h-4 w-4" />}
                        {up ? '+' : ''}{row.pct}%
                      </span>
                    )}
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Overview tiles ───────────────────────────────────────────────────────────

function OverviewTiles() {
  const workouts = useCompletedWorkouts();
  const stats = useMemo(() => recentTrainingStats(workouts, 8), [workouts]);
  if (workouts.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-gap px-4 pt-3">
      <StatTile
        label="Sessies per week"
        value={stats.sessionsPerWeek.toLocaleString('nl-NL')}
        delta="gem. laatste 8 weken"
      />
      <StatTile
        label="Duur per training"
        value={stats.avgMinutes === null ? '—' : `${stats.avgMinutes} min`}
        delta="gem. laatste 8 weken"
      />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type ProgressTab = 'exercises' | 'overview' | 'weight';

const TAB_OPTIONS: { value: ProgressTab; label: string }[] = [
  { value: 'exercises', label: 'Oefeningen' },
  { value: 'overview', label: 'Overzicht' },
  { value: 'weight', label: 'Gewicht' },
];

function isProgressTab(v: string | null): v is ProgressTab {
  return TAB_OPTIONS.some(o => o.value === v);
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-4 pt-4 pb-1 font-display text-body-lg font-semibold">{children}</h2>
  );
}

export function ProgressPage() {
  const exercises = useExercises();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  // `?tab=exercises|overview|weight`; the calendar's session links return to `overview`.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: ProgressTab = isProgressTab(tabParam) ? tabParam : 'exercises';
  const [exerciseView, setExerciseView] = useState<'list' | 'compare'>('list');

  const selectedExercise = useMemo(
    () => exercises.find(e => e.id === selectedId),
    [exercises, selectedId],
  );

  function changeTab(next: string) {
    if (!isProgressTab(next)) return;
    setSearchParams({ tab: next }, { replace: true });
  }

  function openExercise(id: string) {
    setSelectedId(id);
    changeTab('exercises');
  }

  // A specific exercise is open — show its detail without the tab switcher.
  if (tab === 'exercises' && selectedId && selectedExercise) {
    return (
      <div>
        <PageHeader title="Progressie" />
        <ExerciseDetail exercise={selectedExercise} onBack={() => setSelectedId(undefined)} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Progressie" />

      <Tabs value={tab} onValueChange={changeTab}>
        <div className="px-4 py-3">
          <TabsList className="grid w-full grid-cols-3">
            {TAB_OPTIONS.map(opt => (
              <TabsTrigger key={opt.value} value={opt.value}>
                {opt.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="exercises" className="mt-0">
          {/* List ↔ Compare toggle */}
          <div className="flex gap-2 px-4">
            <Chip selected={exerciseView === 'list'} onClick={() => setExerciseView('list')}>
              Lijst
            </Chip>
            <Chip selected={exerciseView === 'compare'} onClick={() => setExerciseView('compare')}>
              Vergelijken
            </Chip>
          </div>
          {exerciseView === 'list' ? (
            <>
              <ProgressionOverview onSelect={openExercise} />
              <div className="px-4 pb-4">
                <WeeklySetsCard />
              </div>
            </>
          ) : (
            <ComparisonView />
          )}
        </TabsContent>

        <TabsContent value="overview" className="mt-0 pb-4">
          <OverviewTiles />
          <SectionHeading>Consistentie</SectionHeading>
          <ConsistencyHeatmap />
          <TrainingCalendar />
          <SectionHeading>Volume</SectionHeading>
          <VolumeTrendChart />
          <SectionHeading>Records</SectionHeading>
          <RecordsBoard onSelect={openExercise} />
        </TabsContent>

        <TabsContent value="weight" className="mt-0">
          <BodyWeightSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
