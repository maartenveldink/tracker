import type { TrainingSchema, SchemaExercise, SchemaDay } from '../../../db/index';

// Pure schema/day helpers (no Dexie), shared by hooks, pages and unit-tested libs.

/** Returns true when the schema has multi-day structure. */
export function isMultiDay(schema: TrainingSchema): boolean {
  return Array.isArray(schema.days) && schema.days.length > 0;
}

/** Returns all exercises across all days (or the flat list for single-day schemas). */
export function getAllSchemaExercises(schema: TrainingSchema): SchemaExercise[] {
  if (isMultiDay(schema)) {
    return schema.days!.flatMap(d => d.exercises);
  }
  return schema.exercises;
}

/** Returns exercises for a specific day, or empty array if not found. */
export function getDayExercises(schema: TrainingSchema, dayId: string): SchemaExercise[] {
  const day = schema.days?.find(d => d.id === dayId);
  return day?.exercises ?? [];
}

/** Returns sorted days or empty array for single-day schemas. */
export function getSortedDays(schema: TrainingSchema): SchemaDay[] {
  if (!isMultiDay(schema)) return [];
  return [...schema.days!].sort((a, b) => a.order - b.order);
}

/**
 * Returns the effective repetition rhythm as an ordered list of day IDs.
 * Falls back to plain day order when no custom rotation is set. Any rotation
 * entries pointing at days that no longer exist are dropped.
 */
export function getRotation(schema: TrainingSchema): string[] {
  const sortedDays = getSortedDays(schema);
  if (sortedDays.length === 0) return [];
  const validIds = new Set(sortedDays.map(d => d.id));
  const rotation = (schema.rotation ?? []).filter(id => validIds.has(id));
  return rotation.length > 0 ? rotation : sortedDays.map(d => d.id);
}
