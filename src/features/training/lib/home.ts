import type { Exercise, SchemaDay, TrainingSchema, Workout } from '../../../db/index';
import { getMuscleGroupById } from '../db/muscles';
import { getRotation, getSortedDays, isMultiDay } from './schemaDays';
import { localDateKey, statsForWeek, trainingDaysSet } from './metrics';
import { NEVER_TRAINED_DAYS, muscleStaleness } from './suggestWorkout';

/** Derived values for the Home screen (DESIGN §5 Home, §9). Pure, no DB access. */

/** Home shows the "first training" empty state until one workout is completed. */
export function isEmptyHome(completedWorkouts: Workout[]): boolean {
  return completedWorkouts.length === 0;
}

export interface WeekDot {
  label: string;
  /** Full weekday name (screen readers). */
  name: string;
  status: 'done' | 'today' | 'rest';
  isToday: boolean;
}

const DAY_LABELS = ['M', 'D', 'W', 'D', 'V', 'Z', 'Z'];
const DAY_NAMES = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];

/** Seven dots Monday..Sunday of the week containing `now`. */
export function weekDots(workouts: Workout[], now: Date = new Date()): WeekDot[] {
  const trained = trainingDaysSet(workouts);
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const todayKey = localDateKey(now);
  return DAY_LABELS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = localDateKey(d);
    const isToday = key === todayKey;
    const status = trained.has(key) ? 'done' : isToday ? 'today' : 'rest';
    return { label, name: DAY_NAMES[i]!, status, isToday };
  });
}

/** Volume change this ISO week vs. last week in whole percent; null when last week had no volume. */
export function volumeDeltaPct(workouts: Workout[], now: Date = new Date()): number | null {
  const prevRef = new Date(now);
  prevRef.setDate(prevRef.getDate() - 7);
  const prev = statsForWeek(workouts, prevRef).volume;
  if (prev <= 0) return null;
  const cur = statsForWeek(workouts, now).volume;
  return Math.round(((cur - prev) / prev) * 100);
}

export interface LastTrainedGroup {
  groupId: string;
  name: string;
  days: number;
  /** days / 7, capped at 1 (bar width). */
  fraction: number;
}

/** The `limit` global muscle groups trained longest ago (never-trained groups are left out). */
export function lastTrainedGroups(
  workouts: Workout[],
  exerciseById: Map<string, Exercise>,
  limit = 3,
  now: Date = new Date(),
): LastTrainedGroup[] {
  return muscleStaleness(workouts, exerciseById, 'global', now)
    .filter(g => g.daysSinceLast < NEVER_TRAINED_DAYS)
    .sort((a, b) => b.daysSinceLast - a.daysSinceLast)
    .slice(0, limit)
    .map(g => ({
      groupId: g.groupId,
      name: getMuscleGroupById(g.groupId)?.name ?? g.groupId,
      days: g.daysSinceLast,
      fraction: Math.min(1, g.daysSinceLast / 7),
    }));
}

export interface NextTraining {
  schema: TrainingSchema;
  /** Set for multi-day schemas. */
  day: SchemaDay | null;
  /** Start date of the previous session of this schema (day), if any. */
  lastDate: Date | null;
}

/**
 * The training that is up next: the schema trained last (else the first one),
 * and for multi-day schemas the next day in its rotation (same rule as the
 * Start screen: completed multi-day sessions modulo rotation length).
 */
export function nextTraining(schemas: TrainingSchema[], completedWorkouts: Workout[]): NextTraining | null {
  if (schemas.length === 0) return null;
  const byId = new Map(schemas.map(s => [s.id, s]));
  const recent = [...completedWorkouts].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const lastWithSchema = recent.find(w => w.schemaId !== null && byId.has(w.schemaId));
  const schema = (lastWithSchema && byId.get(lastWithSchema.schemaId!)) || schemas[0]!;

  let day: SchemaDay | null = null;
  if (isMultiDay(schema)) {
    const days = getSortedDays(schema);
    const rotation = getRotation(schema);
    const done = completedWorkouts.filter(w => w.schemaId === schema.id && w.schemaDayId).length;
    const dayId = rotation[done % rotation.length] ?? days[0]!.id;
    day = days.find(d => d.id === dayId) ?? days[0]!;
  }
  const lastDate = recent.find(w => w.schemaId === schema.id)?.startedAt ?? null;
  return { schema, day, lastDate };
}

/** Distinct global muscle names the given exercises train as primary, in order of first use. */
export function primaryMuscleNames(exerciseIds: string[], exerciseById: Map<string, Exercise>, limit = 3): string[] {
  const names: string[] = [];
  for (const id of exerciseIds) {
    for (const m of exerciseById.get(id)?.primaryMuscles ?? []) {
      const g = getMuscleGroupById(m);
      const name = g?.name;
      if (name && !names.includes(name)) names.push(name);
    }
  }
  return names.slice(0, limit);
}

/** Whole days between `from` and `now` (calendar days, local). */
export function daysAgo(from: Date, now: Date = new Date()): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

