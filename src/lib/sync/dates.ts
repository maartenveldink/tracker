/**
 * Dates survive the trip to PocketBase only as ISO strings (the `data` field is JSON),
 * but the app stores and uses real `Date` objects. Every record pulled from the server
 * must therefore have its date fields revived, or code like `workout.startedAt.getTime()`
 * crashes. Keep in sync with the `Date` fields in `src/db/index.ts`.
 */

/** Date fields per Dexie table. `nullable` fields may legitimately be `null`. */
export const DATE_FIELDS: Record<string, readonly string[]> = {
  exercises: ['createdAt'],
  schemas: ['createdAt', 'updatedAt'],
  workouts: ['startedAt', 'pausedAt', 'completedAt'],
  bodyWeights: ['createdAt'],
  habits: ['createdAt'],
  habitLogs: ['createdAt'],
};

/** PocketBase collection name -> Dexie table name. */
export const COLLECTION_TABLE: Record<string, string> = {
  exercises: 'exercises',
  schemas: 'schemas',
  workouts: 'workouts',
  body_weights: 'bodyWeights',
  habits: 'habits',
  habit_logs: 'habitLogs',
};

/**
 * Returns a copy of `row` where the given fields are `Date`s. Strings are parsed;
 * values that are already `Date`s, `null` or unparseable are left untouched.
 */
export function reviveDateFields<T extends object>(row: T, fields: readonly string[]): T {
  const copy = { ...row } as Record<string, unknown>;
  for (const field of fields) {
    const value = copy[field];
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) copy[field] = parsed;
    }
  }
  return copy as T;
}
