import { useState, useMemo } from 'react';
import { ChevronLeft, Trash2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useExercises } from '../hooks/useExercises';
import {
  useProgress,
  useExercisesWithLastSession,
  deleteWorkout,
  filterByPeriod,
  type PeriodFilter,
  type OneRMFormula,
} from '../hooks/useProgress';
import { PageHeader } from '../components/PageHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

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
  const [period, setPeriod] = useState<PeriodFilter>('3m');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; date: Date } | null>(null);

  // TODO(E8-01): read formula from user settings once the settings screen is implemented
  const formula: OneRMFormula = 'epley';
  const sessions = useProgress(exerciseId, formula);
  const filteredSessions = useMemo(() => filterByPeriod(sessions, period), [sessions, period]);

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
        <h2 className="font-semibold text-base truncate">{exerciseName}</h2>
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
            <div className="px-4 pb-4">
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
                            <span key={i}>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => setDeleteTarget({ id: session.workoutId, date: session.date })}
                        aria-label="Verwijder training"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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

// ── Page ─────────────────────────────────────────────────────────────────────

export function ProgressPage() {
  const exercises = useExercises();
  const [selectedId, setSelectedId] = useState<number | undefined>();

  const selectedExercise = useMemo(
    () => exercises.find(e => e.id === selectedId),
    [exercises, selectedId],
  );

  return (
    <div>
      <PageHeader title="Progressie" />
      {selectedId && selectedExercise ? (
        <ExerciseDetail
          exerciseId={selectedId}
          exerciseName={selectedExercise.name}
          onBack={() => setSelectedId(undefined)}
        />
      ) : (
        <ExerciseList onSelect={setSelectedId} />
      )}
    </div>
  );
}
