import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise, type TrainingSchema } from '../../../db/index';
import { useSettings } from '../../../hooks/useSettings';
import { buildCoachSummary, type CoachPeriodWeeks, type CoachSummary } from '../lib/coachSummary';

/**
 * Live coach summary for a schema over the last `weeks` weeks (shared by the
 * "Kopieer voor AI" section). `summary` is undefined while
 * loading, so callers never act on an empty digest. `exercises` includes
 * deleted ones (their history still counts).
 */
export function useCoachSummary(
  schema: TrainingSchema | null | undefined,
  weeks: CoachPeriodWeeks,
): { summary: CoachSummary | undefined; exercises: Exercise[] | undefined } {
  const settings = useSettings();
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const workouts = useLiveQuery(() =>
    db.workouts.where('status').equals('completed').filter(w => !w.deleted).toArray(),
  );
  const bodyWeights = useLiveQuery(() => db.bodyWeights.filter(b => !b.deleted).toArray());

  const summary = useMemo(() => {
    if (!exercises || !workouts || !bodyWeights || schema === undefined) return undefined;
    return buildCoachSummary({
      workouts,
      exercises,
      schema,
      bodyWeights,
      weeks,
      oneRMFormula: settings.oneRMFormula,
    });
  }, [workouts, exercises, schema, bodyWeights, weeks, settings.oneRMFormula]);

  return { summary, exercises };
}
