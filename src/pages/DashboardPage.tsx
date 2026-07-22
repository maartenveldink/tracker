import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Dumbbell, TrendingUp, Trophy, Play, Scale } from 'lucide-react';
import { useCompletedWorkouts } from '../features/training/hooks/useProgress';
import { useActiveWorkout } from '../features/training/hooks/useWorkout';
import { useExercises } from '../features/training/hooks/useExercises';
import { useBodyWeights, addBodyWeight } from '../features/training/hooks/useBodyWeight';
import { calculateStreak, statsForWeek, recentPRs } from '../features/training/lib/metrics';
import { useSettings } from '../hooks/useSettings';
import { todayISO } from '../lib/dateUtils';
import { PageHeader } from '../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export function DashboardPage() {
  const navigate = useNavigate();
  const workouts = useCompletedWorkouts();
  const activeState = useActiveWorkout();
  const active = activeState?.workout;
  const exercises = useExercises();
  const settings = useSettings();
  const bodyWeights = useBodyWeights();
  const [weight, setWeight] = useState('');

  const nameById = useMemo(() => new Map(exercises.map(e => [e.id!, e.name])), [exercises]);

  const streak = useMemo(() => calculateStreak(workouts), [workouts]);
  const week = useMemo(() => statsForWeek(workouts), [workouts]);
  const prs = useMemo(
    () => recentPRs(workouts, settings.oneRMFormula, 30).slice(0, 3),
    [workouts, settings.oneRMFormula],
  );

  const latestWeight = bodyWeights.length > 0 ? bodyWeights[bodyWeights.length - 1]! : null;

  async function saveWeight() {
    const kg = parseFloat(weight.replace(',', '.'));
    if (!Number.isFinite(kg) || kg <= 0) return;
    await addBodyWeight(todayISO(), Math.round(kg * 10) / 10);
    setWeight('');
  }

  return (
    <div>
      <PageHeader title="Overzicht" />

      <div className="px-4 py-3 space-y-3">
        {/* Resume active/paused workout */}
        {active && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {active.status === 'paused' ? 'Gepauzeerde training' : 'Actieve training'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {active.schemaName ?? 'Vrije training'}
                  {active.schemaDayName ? ` — ${active.schemaDayName}` : ''}
                </p>
              </div>
              <Button size="sm" onClick={() => navigate(`/workout/${active.id}`)}>
                <Play className="h-4 w-4" />
                Hervat
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Streak + this-week stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <Flame className="h-5 w-5 mx-auto text-amber-500" />
              <p className="mt-1 text-xl font-bold tabular-nums">{streak}</p>
              <p className="text-[11px] text-muted-foreground">wk streak</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Dumbbell className="h-5 w-5 mx-auto text-primary" />
              <p className="mt-1 text-xl font-bold tabular-nums">{week.sessions}</p>
              <p className="text-[11px] text-muted-foreground">sessies/wk</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <TrendingUp className="h-5 w-5 mx-auto text-green-500" />
              <p className="mt-1 text-xl font-bold tabular-nums">{Math.round(week.volume / 1000)}k</p>
              <p className="text-[11px] text-muted-foreground">kg volume/wk</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent PRs */}
        {prs.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-amber-500" />
                Recente records
              </p>
              <ul className="space-y-1.5">
                {prs.map(pr => (
                  <li key={pr.exerciseId} className="flex items-center justify-between text-sm gap-2">
                    <span className="truncate">{nameById.get(pr.exerciseId) ?? 'Onbekend'}</span>
                    <span className="text-muted-foreground shrink-0">
                      {pr.weight} kg × {pr.reps} · ~{Math.round(pr.best1RM)} kg
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Quick weigh-in */}
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-primary" />
              Snel wegen
              {latestWeight && (
                <span className="text-muted-foreground font-normal">
                  · laatst {latestWeight.weightKg} kg
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="kg"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                className="w-28"
              />
              <Button type="button" size="sm" onClick={saveWeight} disabled={!weight.trim()}>
                Opslaan
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground"
                onClick={() => navigate('/progress')}
              >
                Grafiek
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Shortcuts */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-11" onClick={() => navigate('/start')}>
            <Play className="h-4 w-4" />
            Start training
          </Button>
          <Button variant="outline" className="h-11" onClick={() => navigate('/progress')}>
            <TrendingUp className="h-4 w-4" />
            Progressie
          </Button>
        </div>
      </div>
    </div>
  );
}
