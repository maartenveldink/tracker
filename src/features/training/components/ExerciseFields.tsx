import { useCallback } from 'react';
import { useLatestOneRMByExercise, estimateWeightForReps } from '../hooks/useProgress';
import { useSettings } from '../../../hooks/useSettings';
import { formatReps } from '../lib/reps';
import { formatRest, resolveRestSeconds } from '../lib/restTime';
import { weightStepForExercise } from '../lib/weightStep';
import {
  stepRepsMaxOf,
  stepRepsOf,
  stepRestOf,
  stepSetsOf,
  stepStartWeightOf,
} from '../lib/exerciseFields';
import { StepperRow } from './ExerciseEditCard';
import type { Exercise, SchemaExercise } from '../../../db/index';

function roundToStep(value: number, step = 2.5): number {
  return Math.round(value / step) * step;
}

/** Suggested start weight (from the latest 1RM and the rep-range lower bound) per exercise. */
export function useStartWeightSuggestion(): (exerciseId: string, repsMin: number) => number | null {
  const settings = useSettings();
  const latestOneRM = useLatestOneRMByExercise(settings.oneRMFormula);
  return useCallback(
    (exerciseId, repsMin) => {
      const oneRM = latestOneRM.get(exerciseId);
      if (!oneRM || oneRM <= 0) return null;
      return roundToStep(estimateWeightForReps(oneRM, repsMin, settings.oneRMFormula));
    },
    [latestOneRM, settings.oneRMFormula],
  );
}

/** What the collapsed card summary shows for the item: effective rest and start weight. */
export function useEffectiveFields() {
  const settings = useSettings();
  const suggest = useStartWeightSuggestion();
  return (item: SchemaExercise, exercise: Exercise | undefined) => {
    const suggestion = suggest(item.exerciseId, item.repsPerSet);
    const inheritedRest = resolveRestSeconds({ exercise, settings });
    return {
      suggestion,
      weight: item.startWeight ?? suggestion,
      rest: item.restSeconds ?? inheritedRest,
    };
  };
}

/**
 * The editable fields of the exercise card, identical in Schema bewerken and
 * the Voorgestelde training: Sets, Reps, Max reps, Startgewicht, Rust. Empty
 * start weight / rest inherit (1RM suggestion / exercise / settings).
 */
export function ExerciseFields({
  item,
  exercise,
  onChange,
}: {
  item: SchemaExercise;
  exercise: Exercise | undefined;
  onChange: (next: SchemaExercise) => void;
}) {
  const settings = useSettings();
  const effective = useEffectiveFields()(item, exercise);
  const isAutoWeight = item.startWeight == null;
  const isAutoRest = item.restSeconds == null;
  const step = weightStepForExercise(exercise, settings.weightSteps);

  return (
    <>
      <StepperRow
        label="Sets"
        value={item.sets}
        decDisabled={item.sets <= 1}
        onDec={() => onChange(stepSetsOf(item, -1))}
        onInc={() => onChange(stepSetsOf(item, 1))}
      />
      <StepperRow
        label="Reps"
        value={item.repsPerSet}
        decDisabled={item.repsPerSet <= 1}
        onDec={() => onChange(stepRepsOf(item, -1))}
        onInc={() => onChange(stepRepsOf(item, 1))}
      />
      <StepperRow
        label="Max reps"
        value={item.repsMax ?? '—'}
        caption={item.repsMax == null ? 'geen bovengrens' : `range ${formatReps(item.repsPerSet, item.repsMax)}`}
        decDisabled={item.repsMax == null}
        onDec={() => onChange(stepRepsMaxOf(item, -1))}
        onInc={() => onChange(stepRepsMaxOf(item, 1))}
      />
      <StepperRow
        label="Startgewicht"
        value={effective.weight != null ? `${effective.weight} kg` : '—'}
        decDisabled={(effective.weight ?? 0) <= 0}
        onDec={() => onChange(stepStartWeightOf(item, -1, effective.suggestion, step))}
        onInc={() => onChange(stepStartWeightOf(item, 1, effective.suggestion, step))}
        onReset={!isAutoWeight && effective.suggestion != null ? () => onChange({ ...item, startWeight: undefined }) : undefined}
        caption={
          isAutoWeight
            ? effective.suggestion != null
              ? `auto o.b.v. 1RM · ${item.repsPerSet} reps`
              : 'geen 1RM-historie'
            : 'handmatig aangepast'
        }
      />
      <StepperRow
        label="Rust"
        value={formatRest(effective.rest)}
        decDisabled={effective.rest <= 15}
        onDec={() => onChange(stepRestOf(item, -15, resolveRestSeconds({ exercise, settings })))}
        onInc={() => onChange(stepRestOf(item, 15, resolveRestSeconds({ exercise, settings })))}
        onReset={!isAutoRest ? () => onChange({ ...item, restSeconds: undefined }) : undefined}
        caption={isAutoRest ? 'standaard' : 'handmatig aangepast'}
      />
    </>
  );
}
