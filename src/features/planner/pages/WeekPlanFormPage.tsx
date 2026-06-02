import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../../components/PageHeader';
import { useWeekPlan, createWeekPlan, updateWeekPlan } from '../hooks/useWeekPlan';
import { useSchemas, isMultiDay, getSortedDays } from '../../training/hooks/useSchemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Moon } from 'lucide-react';
import type { WeekPlanDay, TrainingSchema } from '../../../db/index';

const WEEKDAY_NAMES = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'] as const;

function createEmptyDays(): WeekPlanDay[] {
  return Array.from({ length: 7 }, (_, i) => ({
    weekday: i as WeekPlanDay['weekday'],
    schemaId: null,
    schemaDayId: null,
    label: null,
  }));
}

export function WeekPlanFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = id !== undefined;
  const planId = id ? Number(id) : undefined;
  const existingPlan = useWeekPlan(planId);
  const schemas = useSchemas();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [days, setDays] = useState<WeekPlanDay[]>(createEmptyDays);
  const initialized = useRef(false);

  // Populate form when editing
  useEffect(() => {
    if (isEdit && existingPlan && !initialized.current) {
      initialized.current = true;
      setName(existingPlan.name);
      setDays(existingPlan.days);
    }
  }, [isEdit, existingPlan]);

  function handleSchemaChange(weekday: number, schemaIdStr: string) {
    setDays(prev => prev.map(d => {
      if (d.weekday !== weekday) return d;

      if (schemaIdStr === 'rest') {
        return { ...d, schemaId: null, schemaDayId: null, label: null };
      }

      const schemaId = Number(schemaIdStr);
      const schema = schemas.find(s => s.id === schemaId);

      // For multi-day schemas, auto-select the first day
      let schemaDayId: string | null = null;
      if (schema && isMultiDay(schema)) {
        const sortedDays = getSortedDays(schema);
        schemaDayId = sortedDays[0]?.id ?? null;
      }

      return { ...d, schemaId, schemaDayId, label: null };
    }));
  }

  function handleDayChange(weekday: number, schemaDayId: string) {
    setDays(prev => prev.map(d => {
      if (d.weekday !== weekday) return d;
      return { ...d, schemaDayId };
    }));
  }

  function getSchemaForDay(day: WeekPlanDay): TrainingSchema | undefined {
    if (day.schemaId === null) return undefined;
    return schemas.find(s => s.id === day.schemaId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) return;

    try {
      if (isEdit && planId) {
        await updateWeekPlan(planId, { name: trimmedName, days });
      } else {
        await createWeekPlan(trimmedName, days);
      }
      navigate('/planner');
    } catch {
      // Navigatie blijft achterwege; gebruiker kan opnieuw proberen
    }
  }

  // Show loading state when editing
  if (isEdit && !existingPlan) {
    return (
      <div>
        <PageHeader title="Weekplan bewerken" backTo="/planner" />
        <div className="min-h-[200px]" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Weekplan bewerken' : 'Nieuw weekplan'}
        backTo="/planner"
      />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="plan-name">Naam</Label>
          <Input
            id="plan-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Bijv. Trainingsweek A"
            required
          />
        </div>

        {/* Days */}
        <div className="space-y-2">
          <Label>Weekdagen</Label>
          <div className="space-y-2">
            {days.map((day) => {
              const schema = getSchemaForDay(day);
              const multiDay = schema ? isMultiDay(schema) : false;
              const sortedDays = schema ? getSortedDays(schema) : [];
              const isRest = day.schemaId === null;

              return (
                <Card key={day.weekday} className="shadow-none">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium w-20 shrink-0">
                        {WEEKDAY_NAMES[day.weekday]}
                      </span>

                      <select
                        className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={day.schemaId !== null ? String(day.schemaId) : 'rest'}
                        onChange={e => handleSchemaChange(day.weekday, e.target.value)}
                      >
                        <option value="rest">Rustdag</option>
                        {schemas.map(s => (
                          <option key={s.id} value={String(s.id!)}>
                            {s.name}
                          </option>
                        ))}
                      </select>

                      {isRest && (
                        <Moon className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </div>

                    {/* Day selection for multi-day schemas */}
                    {multiDay && sortedDays.length > 0 && (
                      <div className="ml-20 pl-3">
                        <select
                          className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={day.schemaDayId ?? ''}
                          onChange={e => handleDayChange(day.weekday, e.target.value)}
                        >
                          {sortedDays.map(sd => (
                            <option key={sd.id} value={sd.id}>
                              {sd.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => navigate('/planner')}
          >
            Annuleren
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={!name.trim()}
          >
            {isEdit ? 'Opslaan' : 'Aanmaken'}
          </Button>
        </div>
      </form>
    </div>
  );
}
