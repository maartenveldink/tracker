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
  ResponsiveContainer,
} from 'recharts';
import { useProgress, deleteWorkout, filterByPeriod, type PeriodFilter } from '../hooks/useProgress';
import { useSettings } from '../../../hooks/useSettings';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { shareText, svgToPngBlob, shareImage } from '../../../lib/share';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PeriodChips } from './PeriodChips';
import { WeeklySetsCard } from './WeeklySetsCard';
import { ChartFrame, axisTick, tooltipStyles, useChartColors } from './chartTheme';
import { detectPlateau, isNewPR } from '../lib/progressInsights';
import { resolveStep, weightStepForExercise } from '../lib/weightStep';
import type { Exercise } from '../../../db/index';
import { GoalProgressBar } from './GoalProgressBar';
import { goalProgress } from '../lib/goalProgress';

function formatDate(date: Date): string {
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatKg(n: number): string {
  return n.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

// ── Shared bits ──────────────────────────────────────────────────────────────

export async function shareChartSvg(
  container: HTMLElement | null,
  caption: string,
  filename: string,
  background: string,
) {
  const svg = container?.querySelector('svg');
  if (!svg) {
    await shareText(caption, caption);
    return;
  }
  try {
    const blob = await svgToPngBlob(svg as SVGSVGElement, { background });
    await shareImage(blob, filename, caption);
  } catch {
    await shareText(caption, caption);
  }
}

// ── Detail view ──────────────────────────────────────────────────────────────

export function ExerciseDetail({
  exercise,
  onBack,
  intro,
  headerActions,
}: {
  exercise: Exercise;
  onBack: () => void;
  /** Extra content shown above the goal/chart (the detail page puts the metadata here). */
  intro?: React.ReactNode;
  headerActions?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const exerciseId = exercise.id;
  const exerciseName = exercise.name;
  const [period, setPeriod] = useState<PeriodFilter>('3m');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; date: Date } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const colors = useChartColors();

  const settings = useSettings();
  const formula = settings.oneRMFormula;
  const sessions = useProgress(exerciseId, formula);
  const filteredSessions = useMemo(() => filterByPeriod(sessions, period), [sessions, period]);
  // Goal progress and PR use all-time data, independent of the period filter.
  const progress = useMemo(
    () => goalProgress(exercise.goal, Math.max(0, ...sessions.map(s => s.best1RM)), formula),
    [exercise.goal, sessions, formula],
  );
  const newPR = useMemo(() => isNewPR(sessions.map(s => s.best1RM)), [sessions]);
  const plateau = useMemo(
    () =>
      detectPlateau(
        sessions,
        resolveStep(weightStepForExercise(exercise, settings.weightSteps)).stepKg,
      ),
    [sessions, exercise, settings.weightSteps],
  );

  const latest = sessions[sessions.length - 1];
  const periodDelta =
    filteredSessions.length >= 2
      ? filteredSessions[filteredSessions.length - 1]!.best1RM - filteredSessions[0]!.best1RM
      : null;

  async function shareChart() {
    const caption = latest
      ? `Progressie ${exerciseName} — beste 1RM ~${Math.round(latest.best1RM)} kg`
      : `Progressie ${exerciseName}`;
    await shareChartSvg(chartRef.current, caption, `progressie-${exerciseName}.png`, colors.surface);
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
        <h2 className="flex-1 truncate font-display text-title font-semibold">{exerciseName}</h2>
        {headerActions}
        {sessions.length > 0 && (
          <Button variant="ghost" size="sm" onClick={shareChart} aria-label="Progressie delen">
            <Share2 className="h-4 w-4" />
            Deel
          </Button>
        )}
      </div>

      <Separator />

      <div className="space-y-4 px-4 py-3">
        {intro}
        {progress && (
          <Card>
            <CardContent className="py-3">
              <GoalProgressBar
                progress={progress}
                exerciseName={exerciseName}
                editHref={`/exercises/${exerciseId}/edit`}
              />
            </CardContent>
          </Card>
        )}

        {sessions.length === 0 ? (
          <div className="py-12 text-center text-small text-muted">
            Nog geen gelogde sets voor{' '}
            <span className="font-medium text-text">{exerciseName}</span>.
          </div>
        ) : (
          <>
            {/* 1RM card */}
            <Card>
              <CardContent className="space-y-3">
                <PeriodChips value={period} onChange={setPeriod} />
                <div>
                  <p className="text-caption text-muted">Geschat 1RM</p>
                  <div className="flex items-center gap-2">
                    <p className="font-display text-big font-bold leading-tight">
                      {latest ? Math.round(latest.best1RM) : 0} kg
                    </p>
                    {newPR && <Badge>Nieuw PR</Badge>}
                  </div>
                  {periodDelta !== null && (
                    <p className="text-small text-accent-2">
                      {periodDelta > 0 ? '↑ ' : periodDelta < 0 ? '↓ ' : ''}
                      {formatKg(Math.abs(periodDelta))} kg in deze periode
                    </p>
                  )}
                </div>
                {filteredSessions.length > 0 ? (
                  <div ref={chartRef}>
                    <ChartFrame label={`Lijngrafiek: geschat 1RM van ${exerciseName} in kg`}>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
                          <XAxis dataKey="date" tick={axisTick(colors)} tickLine={false} axisLine={false} />
                          <YAxis
                            tick={axisTick(colors)}
                            tickLine={false}
                            axisLine={false}
                            unit=" kg"
                            width={55}
                          />
                          <Tooltip {...tooltipStyles(colors)} />
                          <Line
                            type="monotone"
                            dataKey="1RM"
                            stroke={colors.accent}
                            strokeWidth={2}
                            dot={{ r: 3, fill: colors.accent }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartFrame>
                  </div>
                ) : (
                  <p className="py-6 text-center text-small text-muted">Geen sessies in deze periode.</p>
                )}
              </CardContent>
            </Card>

            {/* Plateau signal */}
            {plateau && (
              <Card data-testid="plateau-card" className="border-accent-2/50">
                <CardContent className="space-y-1">
                  <h3 className="font-display text-body-lg font-semibold">Plateau-signaal</h3>
                  <p className="text-small text-muted">
                    Je laatste {plateau.sessions} sessies bleven op {formatKg(plateau.weight)} kg ×{' '}
                    {plateau.reps}. Probeer {formatKg(plateau.nextWeight)} kg, of ga naar{' '}
                    {plateau.nextReps} herhalingen.
                  </p>
                </CardContent>
              </Card>
            )}

            <WeeklySetsCard />

            {/* Session list */}
            <section className="space-y-2" aria-label="Sessies">
              <h3 className="font-display text-body-lg font-semibold">
                Sessies ({filteredSessions.length})
              </h3>
              {filteredSessions
                .slice()
                .reverse()
                .map(session => (
                  <Card key={session.workoutId}>
                    <CardContent className="py-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-small font-medium">{formatDate(session.date)}</span>
                            {session.schemaName && (
                              <span className="truncate text-caption text-muted">{session.schemaName}</span>
                            )}
                          </div>
                          <p className="mt-1 text-caption text-muted">
                            {session.sets.map((s, i) => (
                              <span key={s.setNumber}>
                                {i > 0 && ', '}
                                {s.reps} × {s.weight} kg
                              </span>
                            ))}
                          </p>
                          <p className="mt-1 text-caption">
                            <span className="font-medium text-accent">
                              Beste: {session.bestSet.reps} × {session.bestSet.weight} kg
                            </span>
                            <span className="text-muted">
                              {' '}— 1RM: ~{Math.round(session.best1RM * 10) / 10} kg
                            </span>
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-touch w-touch text-muted"
                            onClick={() => navigate(`/workout/${session.workoutId}/edit`)}
                            aria-label="Bewerk training"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-touch w-touch text-muted hover:text-danger"
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
            </section>
          </>
        )}
      </div>

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

