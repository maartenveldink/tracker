import type { TrainingSchema } from '../../../db/index';

/**
 * Schemas shown on Train/Home: the active ones; when none is active,
 * all of them (existing users see nothing disappear).
 */
export function visibleSchemas<T extends Pick<TrainingSchema, 'active'>>(schemas: T[]): T[] {
  const active = schemas.filter(s => s.active === true);
  return active.length > 0 ? active : schemas;
}

/** True when some schemas are not shown by `visibleSchemas`. */
export function hasHiddenSchemas(schemas: Pick<TrainingSchema, 'active'>[]): boolean {
  return visibleSchemas(schemas).length < schemas.length;
}
