import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, Dumbbell, Weight } from 'lucide-react';
import { useCompletedWorkouts } from '../hooks/useProgress';
import { localDateKey, workoutVolume } from '../lib/metrics';
import {
  MONTH_NAMES,
  buildMonthGrid,
  formatDayLabel,
  shiftMonth,
  workoutsByDay,
  type MonthRef,
} from '../lib/calendarMonth';
import { formatDurationLong } from '../../../lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const WEEKDAY_LABELS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

function currentMonth(): MonthRef {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function startTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function trainingLabel(count: number): string {
  return count === 0 ? 'geen training' : count === 1 ? '1 training' : `${count} trainingen`;
}

/** Month calendar of completed workouts; tap a day to see that day's sessions. */
export function TrainingCalendar() {
  const workouts = useCompletedWorkouts();
  const byDay = useMemo(() => workoutsByDay(workouts), [workouts]);
  const [view, setView] = useState<MonthRef>(currentMonth);
  const [selected, setSelected] = useState<string | null>(null);

  const weeks = useMemo(() => buildMonthGrid(view.year, view.month), [view]);
  const todayKey = localDateKey(new Date());
  const now = currentMonth();
  const isCurrentMonth = view.year === now.year && view.month === now.month;
  const isFutureBlocked = view.year * 12 + view.month >= now.year * 12 + now.month;

  function go(next: MonthRef) {
    setView(next);
    setSelected(null);
  }

  const selectedSessions = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <div className="px-4 py-3 space-y-3">
      <Card>
        <CardContent className="p-3" role="group" aria-label="Trainingskalender">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 aria-disabled:opacity-40"
              aria-label="Vorige maand"
              onClick={() => go(shiftMonth(view, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium capitalize" aria-live="polite" data-testid="calendar-month">
                {MONTH_NAMES[view.month]} {view.year}
              </h3>
              {/* Stays mounted (aria-disabled, not removed) so keyboard focus is not lost. */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs aria-disabled:opacity-40"
                aria-disabled={isCurrentMonth}
                onClick={() => {
                  if (!isCurrentMonth) go(now);
                }}
              >
                Vandaag
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 aria-disabled:opacity-40"
              aria-label="Volgende maand"
              aria-disabled={isFutureBlocked}
              onClick={() => {
                if (!isFutureBlocked) go(shiftMonth(view, 1));
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_LABELS.map(l => (
              <span key={l} aria-hidden="true" className="text-[10px] text-muted-foreground pb-1">
                {l}
              </span>
            ))}
            {weeks.flat().map((cell, i) => {
              if (!cell) return <span key={`pad-${i}`} aria-hidden="true" />;
              const count = byDay.get(cell.key)?.length ?? 0;
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === selected;
              return (
                <button
                  key={cell.key}
                  type="button"
                  aria-label={`${formatDayLabel(cell.key)}, ${trainingLabel(count)}`}
                  aria-pressed={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  onClick={() => setSelected(isSelected ? null : cell.key)}
                  className={cn(
                    'relative flex aspect-square items-center justify-center rounded-md text-xs',
                    count > 0
                      ? 'bg-primary/40 font-medium text-foreground'
                      : 'text-muted-foreground',
                    isToday && 'border border-foreground/60',
                    isSelected && 'ring-2 ring-primary',
                  )}
                >
                  {cell.day}
                  {count > 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] leading-none text-primary-foreground"
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selected && (
        <div className="space-y-2" data-testid="calendar-day-details">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {selectedSessions.length === 0
              ? `Geen training op ${formatDayLabel(selected)}`
              : formatDayLabel(selected, true)}
          </p>
          {selectedSessions.map(w => {
            const duration = w.completedAt
              ? w.completedAt.getTime() - w.startedAt.getTime() - w.totalPausedMs
              : null;
            const exerciseCount = w.exercises.length;
            return (
              <Link
                key={w.id}
                to={`/workout/${w.id}/summary`}
                state={{ from: '/progress?tab=overview' }}
                className="block"
              >
                <Card className="shadow-none">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium truncate">
                      {w.schemaName ?? 'Vrije training'}
                      {w.schemaDayName ? ` — ${w.schemaDayName}` : ''}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {startTime(w.startedAt)}
                        {duration != null && ` · ${formatDurationLong(duration)}`}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Dumbbell className="h-3 w-3" />
                        {exerciseCount} {exerciseCount === 1 ? 'oefening' : 'oefeningen'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Weight className="h-3 w-3" />
                        {Math.round(workoutVolume(w))} kg
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
