import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useCompletedWorkouts, type PeriodFilter } from '../hooks/useProgress';
import { useExercises } from '../hooks/useExercises';
import { weeklyVolumeSeries, volumePerMuscleGroup } from '../lib/metrics';
import { getMuscleGroupById } from '../db/muscles';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: '4w', label: '4 weken' },
  { value: '3m', label: '3 maanden' },
  { value: 'all', label: 'Alles' },
];

function cutoffFor(period: PeriodFilter): number {
  if (period === 'all') return 0;
  const d = new Date();
  if (period === '4w') d.setDate(d.getDate() - 28);
  else d.setMonth(d.getMonth() - 3);
  return d.getTime();
}

function formatWeek(date: Date): string {
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

export function VolumeTrendChart() {
  const workouts = useCompletedWorkouts();
  const exercises = useExercises();
  const [period, setPeriod] = useState<PeriodFilter>('3m');

  const exerciseMap = useMemo(() => new Map(exercises.map(e => [e.id!, e])), [exercises]);

  const filtered = useMemo(() => {
    const cutoff = cutoffFor(period);
    return cutoff === 0 ? workouts : workouts.filter(w => w.startedAt.getTime() >= cutoff);
  }, [workouts, period]);

  const weekly = useMemo(
    () =>
      weeklyVolumeSeries(filtered).map(p => ({
        week: formatWeek(p.date),
        volume: Math.round(p.volume),
      })),
    [filtered],
  );

  const muscleBars = useMemo(() => {
    const vol = volumePerMuscleGroup(filtered, exerciseMap);
    const rows = Array.from(vol.entries())
      .map(([id, v]) => ({ id, name: getMuscleGroupById(id)?.name ?? id, volume: v }))
      .sort((a, b) => b.volume - a.volume);
    const max = rows[0]?.volume ?? 0;
    return { rows, max };
  }, [filtered, exerciseMap]);

  if (workouts.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-muted-foreground text-sm">
        Nog geen gelogde trainingen om volume te tonen.
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-4">
      {/* Period filter */}
      <div className="flex gap-2">
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

      {/* Weekly volume */}
      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground mb-2">Volume per week (kg)</p>
          {weekly.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Geen sessies in deze periode.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={45}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value) => [`${value} kg`, 'Volume']}
                />
                <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Muscle balance */}
      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground mb-2">Volume per spiergroep</p>
          {muscleBars.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Geen data in deze periode.</p>
          ) : (
            <div className="space-y-1.5">
              {muscleBars.rows.map(row => (
                <div key={row.id} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-xs truncate">{row.name}</span>
                  <div className="flex-1 h-3 rounded bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded"
                      style={{ width: `${muscleBars.max > 0 ? (row.volume / muscleBars.max) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {Math.round(row.volume)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
