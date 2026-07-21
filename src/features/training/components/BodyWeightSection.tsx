import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Trash2 } from 'lucide-react';
import { useBodyWeights, addBodyWeight, deleteBodyWeight } from '../hooks/useBodyWeight';
import { todayISO } from '../../../lib/dateUtils';
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

export function BodyWeightSection() {
  const entries = useBodyWeights();
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState('');

  const chartData = useMemo(
    () => entries.map(e => ({ date: formatShortDate(e.date), kg: e.weightKg })),
    [entries],
  );

  // Trend: latest vs. first recorded entry
  const delta = useMemo(() => {
    if (entries.length < 2) return null;
    return Math.round((entries[entries.length - 1]!.weightKg - entries[0]!.weightKg) * 10) / 10;
  }, [entries]);

  async function handleSave() {
    const kg = parseFloat(weight.replace(',', '.'));
    if (!Number.isFinite(kg) || kg <= 0) return;
    await addBodyWeight(date, Math.round(kg * 10) / 10);
    setWeight('');
  }

  return (
    <div className="px-4 py-3 space-y-4">
      {/* Input row */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <p className="text-xs text-muted-foreground">Weeg-in toevoegen</p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Datum</label>
              <Input type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="w-24">
              <label className="text-xs text-muted-foreground">Gewicht</label>
              <Input
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
        <div className="py-12 text-center text-muted-foreground text-sm">
          Nog geen gewicht gelogd. Voeg je eerste weeg-in toe.
        </div>
      ) : (
        <>
          {/* Chart */}
          {entries.length >= 2 && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Gewicht (kg)</p>
                  {delta !== null && (
                    <p className="text-xs font-medium">
                      <span className={delta > 0 ? 'text-amber-500' : delta < 0 ? 'text-green-500' : 'text-muted-foreground'}>
                        {delta > 0 ? '+' : ''}{delta} kg
                      </span>
                      <span className="text-muted-foreground"> sinds start</span>
                    </p>
                  )}
                </div>
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
                      domain={['dataMin - 1', 'dataMax + 1']}
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
                      dataKey="kg"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Entry list, newest first */}
          <div className="space-y-2">
            {entries
              .slice()
              .reverse()
              .map(entry => (
                <Card key={entry.id} className="shadow-none">
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{entry.weightKg} kg</span>
                      <span className="text-xs text-muted-foreground">{formatFullDate(entry.date)}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => entry.id && deleteBodyWeight(entry.id)}
                      aria-label="Verwijder weeg-in"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
