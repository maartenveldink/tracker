import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { useExerciseLookup } from '../hooks/useExercises';
import { ExerciseDetail } from '../components/ExerciseDetail';
import { MuscleChip } from '../components/MuscleChip';
import { PageHeader } from '../../../components/PageHeader';
import { useSettings } from '../../../hooks/useSettings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatRest, resolveRestSeconds } from '../lib/restTime';
import { resolveStep, weightStepForExercise } from '../lib/weightStep';
import type { Equipment } from '../../../db/index';

const EQUIPMENT_LABEL: Record<Equipment, string> = {
  cable: 'Cable',
  dumbbell: 'Halter',
  plates: 'Schijven / barbell',
  other: 'Overig',
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption text-muted">{label}</dt>
      <dd className="text-small font-semibold">{value}</dd>
    </div>
  );
}

/**
 * Exercise detail (`/exercises/:id`): muscles, equipment/rest facts and notes on
 * top, then goal, 1RM chart and session history (shared with Progress). Also
 * opens soft-deleted exercises (their history stays viewable) but not editable.
 */
export function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { byId, loading } = useExerciseLookup();
  const settings = useSettings();
  const exercise = id ? byId.get(id) : undefined;

  if (!exercise) {
    return (
      <div>
        <PageHeader title="Oefening" backTo="/exercises" />
        {!loading && <p className="px-5 py-8 text-center text-small text-muted">Oefening niet gevonden.</p>}
      </div>
    );
  }

  const rest = resolveRestSeconds({ exercise, settings });
  const step = resolveStep(weightStepForExercise(exercise, settings.weightSteps));
  const stepLabel = `${step.stepKg.toLocaleString('nl-NL')} kg`;

  const intro = (
    <Card data-testid="exercise-info">
      <CardContent className="space-y-3 py-3">
        {(exercise.primaryMuscles.length > 0 || exercise.secondaryMuscles.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {exercise.primaryMuscles.map(m => <MuscleChip key={m} muscleId={m} type="primary" />)}
            {exercise.secondaryMuscles.map(m => <MuscleChip key={m} muscleId={m} type="secondary" />)}
          </div>
        )}
        {exercise.description && <p className="text-small text-muted">{exercise.description}</p>}
        <dl className="grid grid-cols-2 gap-3">
          <Fact label="Equipment" value={EQUIPMENT_LABEL[exercise.equipment ?? 'other']} />
          <Fact
            label="Rust"
            value={`${formatRest(rest)}${exercise.restTimerSeconds === undefined ? ' (standaard)' : ''}`}
          />
          <Fact label="Gewichtsstap" value={stepLabel} />
          {exercise.laterality && (
            <Fact label="Uitvoering" value={exercise.laterality === 'bilateral' ? 'Bilateraal' : 'Unilateraal'} />
          )}
          {exercise.movementType && (
            <Fact label="Type" value={exercise.movementType === 'compound' ? 'Compound' : 'Isolatie'} />
          )}
        </dl>
      </CardContent>
    </Card>
  );

  return (
    <div>
      <PageHeader title="Oefening" />
      <ExerciseDetail
        exercise={exercise}
        onBack={() => navigate('/exercises')}
        intro={intro}
        headerActions={
          exercise.deleted ? null : (
            <Button asChild variant="ghost" size="sm">
              <Link to={`/exercises/${exercise.id}/edit`} aria-label={`Bewerk ${exercise.name}`}>
                <Pencil className="h-4 w-4" />
                Bewerk
              </Link>
            </Button>
          )
        }
      />
    </div>
  );
}
