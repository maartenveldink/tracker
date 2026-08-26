import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListChecks, ChevronRight } from 'lucide-react';
import { useHabits, useHabitLogs } from '../hooks/useHabits';
import { isScheduledOn, isHabitDone } from '../lib/schedule';
import { HabitControl } from './HabitControl';
import { toISODate } from '../../../lib/dateUtils';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Dashboard card: today's scheduled habits with a completion count and inline
 * check-off. Renders nothing when nothing is scheduled today.
 */
export function HabitsTodayCard() {
  const habits = useHabits();
  const logs = useHabitLogs();
  const navigate = useNavigate();

  const today = useMemo(() => new Date(), []);
  const todayKey = toISODate(today);

  const scheduled = useMemo(
    () => habits.filter(h => isScheduledOn(h.schedule, today)),
    [habits, today],
  );

  const valueByHabit = useMemo(() => {
    const map = new Map<number, number>();
    for (const log of logs) {
      if (log.date === todayKey) map.set(log.habitId, log.value);
    }
    return map;
  }, [logs, todayKey]);

  if (scheduled.length === 0) return null;

  const doneCount = scheduled.filter(h => isHabitDone(h, valueByHabit.get(h.id!) ?? 0)).length;

  return (
    <Card>
      <CardContent className="p-3">
        <button
          type="button"
          onClick={() => navigate('/habits')}
          className="w-full flex items-center justify-between mb-2"
        >
          <span className="text-xs font-medium flex items-center gap-1.5">
            <ListChecks className="h-4 w-4 text-primary" />
            Habits vandaag
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {doneCount}/{scheduled.length}
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>
        <ul className="space-y-1.5">
          {scheduled.map(habit => (
            <li key={habit.id} className="flex items-center justify-between gap-2">
              <span className="text-sm truncate flex items-center gap-1.5">
                {habit.emoji && <span>{habit.emoji}</span>}
                {habit.name}
              </span>
              <HabitControl habit={habit} value={valueByHabit.get(habit.id!) ?? 0} dateKey={todayKey} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
