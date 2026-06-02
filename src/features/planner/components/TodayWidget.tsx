import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveWeekPlan } from '../hooks/useWeekPlan';
import { useSchemas, isMultiDay } from '../../training/hooks/useSchemas';
import { getTodayWeekday } from '../../../lib/dateUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Moon, CalendarDays } from 'lucide-react';
import type { TrainingSchema } from '../../../db/index';

const WEEKDAY_NAMES = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'] as const;

/**
 * Widget showing today's planned training from the active week plan (E9-02).
 * Exportable for future dashboard use.
 */
export function TodayWidget() {
  const navigate = useNavigate();
  const activePlan = useActiveWeekPlan();
  const schemas = useSchemas();
  const todayWeekday = getTodayWeekday();

  const schemasMap = useMemo(
    () => new Map<number, TrainingSchema>(schemas.map(s => [s.id!, s])),
    [schemas],
  );

  if (!activePlan) {
    return (
      <Card className="shadow-none">
        <CardContent className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
            <CalendarDays className="h-4 w-4" />
            <span className="text-sm font-medium">Vandaag</span>
          </div>
          <p className="text-xs text-muted-foreground">Geen planning</p>
        </CardContent>
      </Card>
    );
  }

  const todayPlan = activePlan.days.find(d => d.weekday === todayWeekday);

  if (!todayPlan || todayPlan.schemaId === null) {
    return (
      <Card className="shadow-none border-primary/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Moon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{WEEKDAY_NAMES[todayWeekday]}</span>
          </div>
          <p className="text-xs text-muted-foreground">Rustdag</p>
        </CardContent>
      </Card>
    );
  }

  const schema = schemasMap.get(todayPlan.schemaId);
  const schemaName = schema?.name ?? 'Onbekend schema';
  let dayName: string | null = null;

  if (schema && isMultiDay(schema) && todayPlan.schemaDayId) {
    const day = schema.days?.find(d => d.id === todayPlan.schemaDayId);
    dayName = day?.name ?? null;
  }

  const displayLabel = todayPlan.label ?? (dayName ? `${schemaName} - ${dayName}` : schemaName);

  return (
    <Card className="shadow-none border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{WEEKDAY_NAMES[todayWeekday]}</span>
            </div>
            <p className="text-sm font-medium">{displayLabel}</p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/start')}
          >
            <Play className="h-4 w-4" />
            Start training
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
