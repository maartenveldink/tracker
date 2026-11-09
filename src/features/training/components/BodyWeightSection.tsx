import { useState, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Trash2 } from 'lucide-react';
import { useBodyWeights, addBodyWeight, deleteBodyWeight } from '../hooks/useBodyWeight';
import { todayISO } from '../../../lib/dateUtils';
import { averageChange, weightMovingAverage } from '../lib/progressInsights';
import type { PeriodFilter } from '../hooks/useProgress';
import { PeriodChips } from './PeriodChips';
import { ChartFrame, axisTick, tooltipStyles, useChartColors } from './chartTheme';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

function formatShortDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function formatFullDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatKg(n: number): string {
  return n.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
}

function signed(n: number): string {
  return `${n > 0 ? '+' : ''}${formatKg(n)}`;
}

function periodCutoffISO(period: PeriodFilter): string | null {
  if (period === 'all') return null;
  const d = new Date();
  if (period === '4w') d.setDate(d.getDate() - 28);
  else d.setMonth(d.getMonth() - 3);
  return todayISOFrom(d);
}

function todayISOFrom(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Gewicht tab: 7-day average, chart with raw measurements + average, new measurement, latest entries. */
export function BodyWeightSection() {
  const entries = useBodyWeights();
  const colors = useChartColors();
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('3m');

  // The average is computed over all data, so filtering the period never changes it.
  const points = useMemo(() => weightMovingAverage(entries), [entries]);
  const latest = points[points.length - 1];
  const change = useMemo(() => averageChange(points, 28), [points]);

  const chartData = useMemo(() => {
    const cutoff = periodCutoffISO(period);
    return points
      .filter(p => !cutoff || p.date >= cutoff)
      .map(p => ({ date: formatShortDate(p.date), kg: p.weightKg, avg: p.avg }));
  }, [points, period]);

  async function handleSave() {
    const kg = parseFloat(weight.replace(',', '.'));
    if (!Number.isFinite(kg) || kg <= 0) return;
    await addBodyWeight(date, Math.round(kg * 10) / 10);
    setWeight('');
  }

  // Newest first, with the difference to the previous measurement.
  const recent = useMemo(
    () =>
      entries
        .slice()
        .reverse()
        .map((entry, i, arr) => {
          const prev = arr[i + 1];
          return { entry, diff: prev ? Math.round((entry.weightKg - prev.weightKg) * 10) / 10 : null };
        }),
    [entries],
  );

  return (
    <div className="space-y-4 px-4 py-3">
      {latest && (
        <Card>
          <CardContent className="space-y-3">
            <div>
              <p className="text-caption text-muted">7-daags gemiddelde</p>
              <p className="font-display text-big font-bold leading-tight" data-testid="weight-avg">
                {formatKg(latest.avg)} kg
              </p>
              {change !== null && (
                <p className="text-small text-accent-2">
                  {signed(change)} kg in 4 weken
                </p>
              )}
            </div>
            <PeriodChips value={period} onChange={setPeriod} />
            {chartData.length >= 2 ? (
              <ChartFrame label="Lijngrafiek: lichaamsgewicht in kg, losse metingen en 7-daags gemiddelde">
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
                    <XAxis dataKey="date" tick={axisTick(colors)} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={axisTick(colors)}
                      tickLine={false}
                      axisLine={false}
                      unit=" kg"
                      width={55}
                      domain={['dataMin - 1', 'dataMax + 1']}
                    />
                    <Tooltip {...tooltipStyles(colors)} />
                    <Scatter dataKey="kg" name="Meting" fill={colors.muted} />
                    <Line
                      type="monotone"
                      dataKey="avg"
                      name="7-daags gemiddelde"
                      stroke={colors.accent2}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartFrame>
            ) : (
              <p className="py-6 text-center text-small text-muted">
                Te weinig metingen in deze periode voor een grafiek.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-2">
          <h3 className="font-display text-body-lg font-semibold">Nieuwe meting</h3>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="bw-date" className="text-caption text-muted">Datum</label>
              <Input id="bw-date" type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="w-24">
              <label htmlFor="bw-kg" className="text-caption text-muted">Gewicht</label>
              <Input
                id="bw-kg"
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="kg"
                value={weight}
                onChange={e => setWeight(e.target.value)}
              />
            </div>
            <Button type="button" onClick={handleSave} disabled={!weight.trim()}>
              Opslaan
            </Button>
          </div>
        </CardContent>
      </Card>

      {entries.length === 0 ? (
        <div className="py-12 text-center text-small text-muted">
          Nog geen gewicht gelogd. Voeg je eerste weeg-in toe.
        </div>
      ) : (
        <section aria-label="Metingen" className="space-y-2">
          <h3 className="font-display text-body-lg font-semibold">Metingen</h3>
          {recent.map(({ entry, diff }) => (
            <Card key={entry.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-body font-medium">{entry.weightKg} kg</span>
                  <span className="text-caption text-muted">{formatFullDate(entry.date)}</span>
                </div>
                <div className="flex items-center gap-1">
                  {diff !== null && diff !== 0 && (
                    <span className="text-small tabular-nums text-accent-2">{signed(diff)} kg</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-touch w-touch text-muted hover:text-destructive"
                    onClick={() => entry.id && deleteBodyWeight(entry.id)}
                    aria-label="Verwijder weeg-in"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
