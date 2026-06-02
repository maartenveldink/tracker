import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/PageHeader';
import { useWeekPlans, useActiveWeekPlan, deleteWeekPlan } from '../hooks/useWeekPlan';
import { useSchemas, isMultiDay } from '../../training/hooks/useSchemas';
import { useRecipes } from '../../nutrition/hooks/useRecipes';
import { useSettings } from '../../../hooks/useSettings';
import { getTodayWeekday } from '../../../lib/dateUtils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Play, Plus, Pencil, Trash2, Moon, ChevronDown, ChevronUp, UtensilsCrossed } from 'lucide-react';
import type { WeekPlan, TrainingSchema, WeekPlanDay } from '../../../db/index';

const WEEKDAY_SHORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'] as const;

function getSchemaLabel(
  schemaId: number | null,
  schemaDayId: string | null,
  label: string | null,
  schemasMap: Map<number, TrainingSchema>,
): string {
  if (label) return label;
  if (schemaId === null) return 'Rustdag';

  const schema = schemasMap.get(schemaId);
  if (!schema) return 'Onbekend schema';

  if (schemaDayId && isMultiDay(schema)) {
    const day = schema.days?.find(d => d.id === schemaDayId);
    return day ? `${schema.name} - ${day.name}` : schema.name;
  }

  return schema.name;
}

export function PlannerPage() {
  const navigate = useNavigate();
  const weekPlans = useWeekPlans();
  const activePlan = useActiveWeekPlan();
  const schemas = useSchemas();
  const recipes = useRecipes();
  const todayWeekday = getTodayWeekday();

  const [deleteTarget, setDeleteTarget] = useState<WeekPlan | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const settings = useSettings();
  const hasMacroGoals = settings.macroGoals &&
    (settings.macroGoals.calories !== null || settings.macroGoals.protein !== null);

  const schemasMap = useMemo(() => new Map(schemas.map(s => [s.id!, s])), [schemas]);

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    await deleteWeekPlan(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <div>
      <PageHeader title="Weekplanner" />

      <div className="px-4 py-4">
        <Tabs defaultValue="overview">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">Weekoverzicht</TabsTrigger>
            <TabsTrigger value="manage" className="flex-1">Beheer</TabsTrigger>
          </TabsList>

          {/* Tab 1: Week overview */}
          <TabsContent value="overview">
            {!activePlan ? (
              <div className="text-center py-12 space-y-4">
                <p className="text-muted-foreground text-sm">
                  Geen weekplan ingesteld — maak een weekplan aan.
                </p>
                <Button onClick={() => navigate('/planner/new')}>
                  <Plus className="h-4 w-4" />
                  Weekplan aanmaken
                </Button>
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                <p className="text-xs text-muted-foreground mb-3">
                  Actief plan: <span className="font-medium text-foreground">{activePlan.name}</span>
                </p>
                {activePlan.days.map((day) => {
                  const isToday = day.weekday === todayWeekday;
                  const isRest = day.schemaId === null;
                  const dayLabel = getSchemaLabel(day.schemaId, day.schemaDayId, day.label, schemasMap);
                  const isExpanded = expandedDay === day.weekday;

                  return (
                    <Card
                      key={day.weekday}
                      className={`shadow-none transition-colors ${
                        isToday ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 text-center shrink-0">
                            <span className={`text-xs font-bold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                              {WEEKDAY_SHORT[day.weekday]}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {dayLabel}
                              </span>
                              {isToday && (
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  Vandaag
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {!isRest && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  navigate('/start', {
                                    state: {
                                      suggestedSchemaId: (day as WeekPlanDay).schemaId,
                                      suggestedSchemaDayId: (day as WeekPlanDay).schemaDayId,
                                    },
                                  });
                                }}
                                aria-label="Start training"
                              >
                                <Play className="h-4 w-4 text-primary" />
                              </Button>
                            )}
                            {isRest && (
                              <Moon className="h-4 w-4 text-muted-foreground" />
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setExpandedDay(isExpanded ? null : day.weekday)}
                              aria-label="Maaltijdadvies"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Meal advice placeholder (E9-03, E9-04, E9-06) */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <div className="flex items-center gap-2 mb-2">
                              <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                              <span className="text-xs font-medium text-muted-foreground">Maaltijdadvies</span>
                            </div>
                            {!hasMacroGoals || recipes.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                Maaltijdsuggesties zijn beschikbaar zodra je recepten hebt toegevoegd en macrodoelen hebt ingesteld.
                              </p>
                            ) : (
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground mb-2">Beschikbare recepten:</p>
                                {recipes.map(recipe => (
                                  <div key={recipe.id} className="text-xs flex justify-between py-1">
                                    <span className="truncate">{recipe.name}</span>
                                    <span className="text-muted-foreground shrink-0 ml-2">
                                      {Math.round(recipe.calories)} kcal | {Math.round(recipe.protein)}g eiwit
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Tab 2: Manage week plans */}
          <TabsContent value="manage">
            <div className="space-y-4 mt-2">
              <Button
                className="w-full"
                onClick={() => navigate('/planner/new')}
              >
                <Plus className="h-4 w-4" />
                Nieuw weekplan
              </Button>

              {weekPlans.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  Nog geen weekplannen aangemaakt.
                </p>
              ) : (
                <div className="space-y-2">
                  {weekPlans.map(plan => {
                    const isActive = activePlan?.id === plan.id;
                    const trainingDays = plan.days.filter(d => d.schemaId !== null).length;

                    return (
                      <Card key={plan.id} className={`shadow-none ${isActive ? 'border-primary' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-sm">{plan.name}</h3>
                                {isActive && (
                                  <Badge variant="secondary" className="text-xs">Actief</Badge>
                                )}
                              </div>
                              <p className="text-muted-foreground text-xs mt-0.5">
                                {trainingDays} trainingsdag{trainingDays !== 1 ? 'en' : ''} |
                                {' '}Aangemaakt {plan.createdAt.toLocaleDateString('nl-NL')}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigate(`/planner/${plan.id}/edit`)}
                                aria-label="Bewerk weekplan"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => setDeleteTarget(plan)}
                                aria-label="Verwijder weekplan"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Weekplan verwijderen"
        message={`Weet je zeker dat je "${deleteTarget?.name ?? ''}" wilt verwijderen?`}
        confirmLabel="Verwijderen"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
