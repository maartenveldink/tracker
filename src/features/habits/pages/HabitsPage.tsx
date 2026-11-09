import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import type { Habit, HabitLog } from '../../../db/index';
import { useHabits, useHabitLogs, reorderHabits } from '../hooks/useHabits';
import { isScheduledOn, doneByDateForHabit, habitStreak, isHabitDone, scheduleLabel } from '../lib/schedule';
import { toISODate } from '../../../lib/dateUtils';
import { HabitControl } from '../components/HabitControl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

function formatDayLabel(date: Date, todayKey: string): string {
  const key = toISODate(date);
  if (key === todayKey) return 'Vandaag';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === toISODate(yesterday)) return 'Gisteren';
  return date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function HabitsPage() {
  const habits = useHabits();
  const logs = useHabitLogs();
  const navigate = useNavigate();

  const [selected, setSelected] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const todayKey = toISODate(new Date());
  const selectedKey = toISODate(selected);
  const isToday = selectedKey === todayKey;

  // Fast lookup of a habit's value on the selected day.
  const valueByHabit = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of logs) {
      if (log.date === selectedKey) map.set(log.habitId, log.value);
    }
    return map;
  }, [logs, selectedKey]);

  const scheduled = useMemo(
    () => habits.filter(h => isScheduledOn(h.schedule, selected)),
    [habits, selected],
  );

  function shiftDay(delta: number) {
    setSelected(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + delta);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (next > today) return prev; // no future logging
      return next;
    });
  }

  // Swap a habit with its visible neighbour, preserving the order of habits that
  // aren't shown on this day, then persist the full reindexed order.
  function moveHabit(habitId: string, dir: -1 | 1) {
    const vi = scheduled.findIndex(h => h.id === habitId);
    const neighbour = scheduled[vi + dir];
    if (!neighbour) return;
    const ids = habits.map(h => h.id);
    const ia = ids.indexOf(habitId);
    const ib = ids.indexOf(neighbour.id);
    [ids[ia], ids[ib]] = [ids[ib]!, ids[ia]!];
    void reorderHabits(ids);
  }

  const doneCount = scheduled.filter(h => isHabitDone(h, valueByHabit.get(h.id) ?? 0)).length;
  const percent = scheduled.length > 0 ? Math.round((doneCount / scheduled.length) * 100) : 0;

  return (
    <div className="px-screen-x pt-6 pb-4 space-y-gap">
      <header className="flex items-center justify-between px-0.5">
        <h1 className="font-display text-screen font-bold tracking-tight">Habits</h1>
        <Button asChild variant="outline" className="rounded-pill px-4">
          <Link to="/habits/new" aria-label="Nieuwe habit">
            + Nieuw
          </Link>
        </Button>
      </header>

      {/* Day navigator */}
      <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center">
        <Button variant="ghost" size="icon" onClick={() => shiftDay(-1)} aria-label="Vorige dag">
          <ChevronLeft className="h-[18px] w-[18px]" />
        </Button>
        <span className="text-center text-body font-semibold capitalize">{formatDayLabel(selected, todayKey)}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => shiftDay(1)}
          disabled={isToday}
          aria-label="Volgende dag"
        >
          <ChevronRight className="h-[18px] w-[18px]" />
        </Button>
      </div>

      {scheduled.length > 0 && (
        <Card className="p-[18px] flex flex-col gap-2.5" data-testid="habits-summary">
          <div className="flex items-baseline justify-between">
            <span className="text-small font-semibold">
              {doneCount} van {scheduled.length} gedaan
            </span>
            <span className="text-caption text-muted">{percent}%</span>
          </div>
          <Progress value={percent} aria-label={`${percent}% van de habits gedaan`} />
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {habits.length === 0 ? (
          <div className="py-16 text-center text-muted text-small">
            Nog geen habits.{' '}
            <Link to="/habits/new" className="text-accent underline">
              Maak je eerste habit
            </Link>
            .
          </div>
        ) : scheduled.length === 0 ? (
          <div className="py-16 text-center text-muted text-small">
            Geen habits gepland voor deze dag.
          </div>
        ) : (
          scheduled.map((habit, i) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              value={valueByHabit.get(habit.id) ?? 0}
              dateKey={selectedKey}
              logs={logs}
              canMoveUp={i > 0}
              canMoveDown={i < scheduled.length - 1}
              onMove={dir => moveHabit(habit.id, dir)}
              onOpen={() => navigate(`/habits/${habit.id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function HabitRow({
  habit,
  value,
  dateKey,
  logs,
  canMoveUp,
  canMoveDown,
  onMove,
  onOpen,
}: {
  habit: Habit;
  value: number;
  dateKey: string;
  logs: HabitLog[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (dir: -1 | 1) => void;
  onOpen: () => void;
}) {
  const done = isHabitDone(habit, value);
  const streak = useMemo(
    () => habitStreak(habit, doneByDateForHabit(habit, logs)),
    [habit, logs],
  );

  const isBoolean = habit.type === 'boolean';

  return (
    <Card data-testid="habit-row" className={cn('rounded-row min-h-16 flex items-center gap-2 py-2 pl-2.5 pr-4', done && 'border-accent/50')}>
      {isBoolean && <HabitControl habit={habit} value={value} dateKey={dateKey} />}
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left rounded-row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex items-center gap-2">
          {habit.emoji && <span className="text-lg">{habit.emoji}</span>}
          <span className="text-body-lg font-semibold truncate">{habit.name}</span>
        </span>
        <span className="block text-caption text-muted truncate">
          {scheduleLabel(habit.schedule)}
          {streak > 0 && ` · ${streak} ${streak === 1 ? 'dag' : 'dagen'}`}
        </span>
      </button>
      {!isBoolean && <HabitControl habit={habit} value={value} dateKey={dateKey} />}
      {(canMoveUp || canMoveDown) && (
        <div className="flex flex-col shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-8 text-muted"
            onClick={() => onMove(-1)}
            disabled={!canMoveUp}
            aria-label="Omhoog"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-8 text-muted"
            onClick={() => onMove(1)}
            disabled={!canMoveDown}
            aria-label="Omlaag"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}
    </Card>
  );
}
