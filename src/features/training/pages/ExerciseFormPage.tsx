import { useNavigate, useParams } from 'react-router-dom';
import { useExercise } from '../hooks/useExercises';
import { ExerciseForm } from '../components/ExerciseForm';
import { PageHeader } from '../../../components/PageHeader';

export function ExerciseFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id !== undefined;
  const exerciseId = id ? Number(id) : undefined;
  const existing = useExercise(exerciseId);
  const navigate = useNavigate();

  // When editing, wait for the record to load before mounting the form so it
  // can initialise from the existing exercise.
  if (isEditing && !existing) {
    return (
      <div>
        <PageHeader title="Oefening bewerken" backTo="/exercises" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isEditing ? 'Oefening bewerken' : 'Nieuwe oefening'}
        backTo="/exercises"
      />
      <div className="px-4 py-4">
        <ExerciseForm existing={existing} onSaved={() => navigate('/exercises')} />
      </div>
    </div>
  );
}
