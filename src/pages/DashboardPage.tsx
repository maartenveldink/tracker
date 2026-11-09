import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Play, Trophy } from 'lucide-react';
import { useCompletedWorkoutsQuery } from '../features/training/hooks/useProgress';
import { useActiveWorkout, startWorkout } from '../features/training/hooks/useWorkout';
import { useExerciseLookup } from '../features/training/hooks/useExercises';
import { useSchemas, getAllSchemaExercises } from '../features/training/hooks/useSchemas';
import { useBodyWeights, addBodyWeight } from '../features/training/hooks/useBodyWeight';
import { calculateStreak, statsForWeek, recentPRs } from '../features/training/lib/metrics';
import {
  daysAgo,
  isEmptyHome,
  lastTrainedGroups,
  nextTraining,
  primaryMuscleNames,
  volumeDeltaPct,
  weekDots,
} from '../features/training/lib/home';
import { estimateExercisesSeconds, formatEstimatedTime } from '../features/training/lib/estimateSchemaTime';
import { useSettings } from '../hooks/useSettings';
import { todayISO } from '../lib/dateUtils';
import { cn } from '@/lib/utils';
import { DeloadCard } from '../features/training/components/DeloadCard';
import { HabitsTodayCard } from '../features/habits/components/HabitsTodayCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const nl = (n: number, digits = 1) =>
  n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: digits });

function formatVolume(kg: number): string {
  return kg >= 1000 ? `${nl(kg / 1000)}k` : nl(Math.round(kg), 0);
}

function agoLabel(days: number): string {
  if (days <= 0) return 'vandaag';
  if (days === 1) return 'gisteren';
  return `${days} dagen geleden`;
}

function dateLine(d: Date): string {
  const s = d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function DashboardPage() {
  const navigate = useNavigate();
  const loaded = useCompletedWorkoutsQuery();
  const loading = loaded === undefined;
  const workouts = useMemo(() => loaded ?? [], [loaded]);
  const activeState = useActiveWorkout();
  const active = activeState?.workout;
  const { byId, nameOf } = useExerciseLookup();
  const schemas = useSchemas();
  const settings = useSettings();
  const bodyWeights = useBodyWeights();
  const [weight, setWeight] = useState('');
  const [logOpen, setLogOpen] = useState(false);

  const now = useMemo(() => new Date(), []);
  const empty = isEmptyHome(workouts);
  const streak = useMemo(() => calculateStreak(workouts), [workouts]);
  const week = useMemo(() => statsForWeek(workouts), [workouts]);
  const delta = useMemo(() => volumeDeltaPct(workouts), [workouts]);
  const dots = useMemo(() => weekDots(workouts), [workouts]);
  const groups = useMemo(() => lastTrainedGroups(workouts, byId, 3), [workouts, byId]);
  const prs = useMemo(
    () => recentPRs(workouts, settings.oneRMFormula, 30).slice(0, 3),
    [workouts, settings.oneRMFormula],
  );
  const next = useMemo(() => nextTraining(schemas, workouts), [schemas, workouts]);

  const latestWeight = bodyWeights.length > 0 ? bodyWeights[bodyWeights.length - 1]! : null;

  const hero = useMemo(() => {
    if (!next) return null;
    const exercises = next.day ? next.day.exercises : getAllSchemaExercises(next.schema);
    return {
      title: next.day?.name ?? next.schema.name,
      muscles: primaryMuscleNames(exercises.map(e => e.exerciseId), byId),
      count: exercises.length,
      seconds: estimateExercisesSeconds(exercises, byId, settings),
      lastDate: next.lastDate,
    };
  }, [next, byId, settings]);

  async function saveWeight() {
    const kg = parseFloat(weight.replace(',', '.'));
    if (!Number.isFinite(kg) || kg <= 0) return;
    await addBodyWeight(todayISO(), Math.round(kg * 10) / 10);
    setWeight('');
    setLogOpen(false);
  }

  async function startFree() {
    const id = await startWorkout(null, null, []);
    navigate(`/workout/${id}`);
  }

  const weightForm = (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
      <Input
        type="number"
        inputMode="decimal"
        step="0.1"
        placeholder="kg"
        aria-label="Gewicht in kilogram"
        value={weight}
        onChange={e => setWeight(e.target.value)}
        className="h-12 rounded-[14px] text-base"
      />
      <Button type="button" className="h-12 rounded-[14px] px-5" onClick={saveWeight} disabled={!weight.trim()}>
        Opslaan
      </Button>
    </div>
  );

  return (
    <div className="px-screen-x pt-6 pb-4 space-y-gap">
      <header className="px-0.5 pb-1">
        <p className="text-small text-muted">{dateLine(now)}</p>
        <h1 className="font-display text-screen font-bold tracking-tight">Vandaag</h1>
      </header>

      {loading ? null : (<>
      {/* Resume active/paused workout */}
      {active && (
        <Card emphasis>
          <CardContent className="p-3 pt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {active.status === 'paused' ? 'Gepauzeerde training' : 'Actieve training'}
              </p>
              <p className="text-xs text-muted truncate">
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

      {/* Hero */}
      <Card className="p-5 flex flex-col gap-4">
        {empty ? (
          <>
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-screen font-bold tracking-tight">Begin je eerste training</h2>
              <p className="text-small leading-relaxed text-muted">
                Je hebt nog niets gelogd. Start meteen zonder schema, of maak eerst een schema aan.
              </p>
            </div>
            <Button size="lg" onClick={startFree}>
              <Play className="h-5 w-5 fill-current" />
              Start vrije training
            </Button>
            <Button variant="secondary" className="h-12 rounded-button" onClick={() => navigate('/schemas/new')}>
              Schema maken
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-semibold uppercase tracking-[0.08em] text-accent">Aan de beurt</span>
              <h2 className="font-display text-hero font-bold leading-tight tracking-tight">
                {hero ? hero.title : 'Voorgestelde training'}
              </h2>
              <p className="text-small text-muted">
                {hero
                  ? hero.muscles.join(' · ')
                  : 'Op maat, gericht op spiergroepen die je lang niet trainde'}
              </p>
            </div>
            {hero && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
                <span>{hero.count} {hero.count === 1 ? 'oefening' : 'oefeningen'}</span>
                <span>ca. {formatEstimatedTime(hero.seconds).replace('~', '')}</span>
                {hero.lastDate && <span>Laatst {agoLabel(daysAgo(hero.lastDate, now))}</span>}
              </div>
            )}
            <Button size="lg" onClick={() => navigate(hero ? '/start' : '/start/suggestion')}>
              <Play className="h-5 w-5 fill-current" />
              Start training
            </Button>
            <Button variant="ghost" className="h-touch" onClick={startFree}>
              Vrije training starten
            </Button>
          </>
        )}
      </Card>

      {/* Week card */}
      {!empty && (
        <Card className="px-[18px] py-4 flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-small font-semibold">Deze week</span>
            <span className="text-caption text-muted">
              {week.sessions} {week.sessions === 1 ? 'sessie' : 'sessies'}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5" role="list" aria-label="Trainingsdagen deze week">
            {dots.map((d, i) => (
              <div key={i} role="listitem" className="flex flex-col items-center gap-1.5">
                <span className="text-caption text-muted" aria-hidden="true">{d.label}</span>
                <span
                  className={cn(
                    'flex h-[30px] w-[30px] items-center justify-center rounded-full text-small font-bold',
                    d.status === 'done' && 'bg-accent text-on-accent',
                    d.status === 'today' && 'border-2 border-accent text-accent',
                    d.status === 'rest' && 'bg-line text-muted',
                  )}
                >
                  <span aria-hidden="true">{d.status === 'done' ? '✓' : d.status === 'today' ? '•' : ''}</span>
                  <span className="sr-only">
                    {d.name}: {d.status === 'done' ? 'getraind' : d.isToday ? 'vandaag, nog niet getraind' : 'niet getraind'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-gap">
        {empty ? (
          <>
            <StatTile label="weken streak" value={<span className="text-muted">–</span>} />
            <StatTile label="volume" value={<span className="text-muted">–</span>} />
            <StatTile label="gewicht" value={<span className="text-muted">–</span>} />
          </>
        ) : (
          <>
            <StatTile
              label="weken streak"
              value={
                <span className="flex items-center gap-1.5">
                  <Flame className="h-5 w-5 text-accent" aria-hidden="true" />
                  {streak}
                </span>
              }
            />
            <StatTile
              label="volume"
              value={formatVolume(week.volume)}
              delta={delta === null ? undefined : `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)}% t.o.v. vorige wk`}
            />
            <StatTile
              data-testid="weight-tile"
              label={latestWeight ? 'laatst, kg' : 'gewicht'}
              value={latestWeight ? nl(latestWeight.weightKg) : <span className="text-muted">–</span>}
              action={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-1 h-7 rounded-chip px-2.5"
                  onClick={() => setLogOpen(true)}
                >
                  + Log
                </Button>
              }
            />
          </>
        )}
      </div>

      {/* Empty state: quick weigh-in inline */}
      {empty && (
        <Card className="px-[18px] py-4 flex flex-col gap-3" data-testid="weight-tile">
          <div className="flex flex-col gap-0.5">
            <span className="text-small font-semibold">Snel wegen</span>
            <span className="text-caption text-muted">
              {latestWeight
                ? `Laatst ${nl(latestWeight.weightKg)} kg`
                : 'Log je eerste meting, dan zie je het verloop in Progressie.'}
            </span>
          </div>
          {weightForm}
        </Card>
      )}

      <DeloadCard />

      {/* Last trained per muscle group */}
      {groups.length > 0 && (
        <Card className="px-[18px] py-4 flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-small font-semibold">Laatst getraind</span>
            <span className="text-caption text-muted">per spiergroep</span>
          </div>
          {groups.map((g, i) => (
            <div key={g.groupId} className="grid grid-cols-[76px_minmax(0,1fr)_64px] items-center gap-2.5">
              <span className="truncate text-small">{g.name}</span>
              <div className="h-2 rounded bg-line" aria-hidden="true">
                <div
                  className={cn('h-2 rounded', i === 0 ? 'bg-accent' : 'bg-accent-2')}
                  style={{ width: `${Math.max(4, Math.round(g.fraction * 100))}%` }}
                />
              </div>
              <span className={cn('text-right text-caption', i === 0 ? 'text-accent' : 'text-muted')}>
                {g.days} {g.days === 1 ? 'dag' : 'dagen'}
              </span>
            </div>
          ))}
        </Card>
      )}

      {/* Recent PRs */}
      {prs.length > 0 && (
        <Card className="px-[18px] py-4">
          <p className="mb-2 flex items-center gap-1.5 text-small font-semibold">
            <Trophy className="h-4 w-4 text-accent" aria-hidden="true" />
            Recente records
          </p>
          <ul className="space-y-1.5">
            {prs.map(pr => (
              <li key={pr.exerciseId} className="flex items-center justify-between gap-2 text-small">
                <span className="truncate">{nameOf(pr.exerciseId)}</span>
                <span className="shrink-0 text-muted">
                  {pr.weight} kg × {pr.reps} · ~{Math.round(pr.best1RM)} kg
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Today's habits — kept last on the page */}
      <HabitsTodayCard />

      </>)}

      <Sheet open={logOpen} onOpenChange={setLogOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Gewicht loggen</SheetTitle>
            <SheetDescription className="sr-only">Voer je gewicht van vandaag in kilogram in.</SheetDescription>
          </SheetHeader>
          <div className="mt-4">{weightForm}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
