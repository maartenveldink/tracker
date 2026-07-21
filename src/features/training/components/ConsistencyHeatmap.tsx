import { useMemo } from 'react';
import { useCompletedWorkouts } from '../hooks/useProgress';
import { trainingDayCounts, localDateKey } from '../lib/metrics';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const WEEKS = 26;
const WEEKDAY_LABELS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

function levelClass(count: number): string {
  if (count <= 0) return 'bg-muted';
  if (count === 1) return 'bg-primary/40';
  if (count === 2) return 'bg-primary/70';
  return 'bg-primary';
}

export function ConsistencyHeatmap() {
  const workouts = useCompletedWorkouts();
  const counts = useMemo(() => trainingDayCounts(workouts), [workouts]);

  const { columns, totalDays } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Monday of the current week (0 = Monday)
    const dayIdx = (today.getDay() + 6) % 7;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - dayIdx);
    const startMonday = new Date(currentMonday);
    startMonday.setDate(currentMonday.getDate() - (WEEKS - 1) * 7);

    const cols: { key: string; count: number; future: boolean }[][] = [];
    let trained = 0;
    for (let w = 0; w < WEEKS; w++) {
      const col: { key: string; count: number; future: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const cell = new Date(startMonday);
        cell.setDate(startMonday.getDate() + w * 7 + d);
        const key = localDateKey(cell);
        const count = counts.get(key) ?? 0;
        if (count > 0) trained++;
        col.push({ key, count, future: cell > today });
      }
      cols.push(col);
    }
    return { columns: cols, totalDays: trained };
  }, [counts]);

  return (
    <div className="px-4 py-3 space-y-3">
      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground mb-2">
            Getraind op {totalDays} {totalDays === 1 ? 'dag' : 'dagen'} in de laatste {WEEKS} weken
          </p>
          <div className="flex gap-2">
            {/* Weekday labels */}
            <div className="flex flex-col gap-1 pt-0.5">
              {WEEKDAY_LABELS.map((l, i) => (
                <span key={l} className="h-3 text-[9px] leading-3 text-muted-foreground">
                  {i % 2 === 0 ? l : ''}
                </span>
              ))}
            </div>
            {/* Week columns */}
            <div className="flex gap-1 overflow-x-auto">
              {columns.map((col, i) => (
                <div key={i} className="flex flex-col gap-1">
                  {col.map(cell => (
                    <div
                      key={cell.key}
                      title={cell.future ? undefined : `${cell.key}: ${cell.count}×`}
                      className={cn(
                        'h-3 w-3 rounded-sm',
                        cell.future ? 'bg-transparent' : levelClass(cell.count),
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-muted-foreground">
            <span>minder</span>
            <div className="h-3 w-3 rounded-sm bg-muted" />
            <div className="h-3 w-3 rounded-sm bg-primary/40" />
            <div className="h-3 w-3 rounded-sm bg-primary/70" />
            <div className="h-3 w-3 rounded-sm bg-primary" />
            <span>meer</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
