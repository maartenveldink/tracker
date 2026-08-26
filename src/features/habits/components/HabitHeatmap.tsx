import { useMemo } from 'react';
import type { HabitSchedule } from '../../../db/index';
import { isScheduledOn } from '../lib/schedule';
import { toISODate } from '../../../lib/dateUtils';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const WEEKS = 26;
const WEEKDAY_LABELS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

interface HabitHeatmapProps {
  schedule: HabitSchedule;
  doneByDate: Map<string, boolean>;
}

/**
 * Per-habit 26-week heatmap. Only scheduled days get a slot; done days are
 * filled, scheduled-not-done days are muted, non-scheduled days are blank.
 */
export function HabitHeatmap({ schedule, doneByDate }: HabitHeatmapProps) {
  const { columns, doneCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayIdx = (today.getDay() + 6) % 7; // 0 = Monday
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - dayIdx);
    const startMonday = new Date(currentMonday);
    startMonday.setDate(currentMonday.getDate() - (WEEKS - 1) * 7);

    const cols: { key: string; scheduled: boolean; done: boolean; future: boolean }[][] = [];
    let done = 0;
    for (let w = 0; w < WEEKS; w++) {
      const col: { key: string; scheduled: boolean; done: boolean; future: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const cell = new Date(startMonday);
        cell.setDate(startMonday.getDate() + w * 7 + d);
        const key = toISODate(cell);
        const future = cell > today;
        const scheduled = !future && isScheduledOn(schedule, cell);
        const isDone = scheduled && doneByDate.get(key) === true;
        if (isDone) done++;
        col.push({ key, scheduled, done: isDone, future });
      }
      cols.push(col);
    }
    return { columns: cols, doneCount: done };
  }, [schedule, doneByDate]);

  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground mb-2">
          {doneCount} {doneCount === 1 ? 'keer' : 'keer'} voltooid in de laatste {WEEKS} weken
        </p>
        <div className="flex gap-2">
          <div className="flex flex-col gap-1 pt-0.5">
            {WEEKDAY_LABELS.map((l, i) => (
              <span key={l} className="h-3 text-[9px] leading-3 text-muted-foreground">
                {i % 2 === 0 ? l : ''}
              </span>
            ))}
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {columns.map((col, i) => (
              <div key={i} className="flex flex-col gap-1">
                {col.map(cell => (
                  <div
                    key={cell.key}
                    title={cell.scheduled ? `${cell.key}: ${cell.done ? 'voltooid' : 'niet voltooid'}` : undefined}
                    className={cn(
                      'h-3 w-3 rounded-sm',
                      !cell.scheduled ? 'bg-transparent' : cell.done ? 'bg-primary' : 'bg-muted',
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
