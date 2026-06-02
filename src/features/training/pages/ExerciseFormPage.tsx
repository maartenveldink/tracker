import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useExercise, createExercise, updateExercise } from '../hooks/useExercises';
import { getMuscleGroups } from '../db/muscles';
import { MuscleChip } from '../components/MuscleChip';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ExerciseFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id !== undefined;
  const exerciseId = id ? Number(id) : undefined;
  const existing = useExercise(exerciseId);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [primaryMuscles, setPrimaryMuscles] = useState<string[]>([]);
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);

  const muscleGroups = getMuscleGroups('global');
  const initialized = useRef(false);

  useEffect(() => {
    if (existing && !initialized.current) {
      initialized.current = true;
      setName(existing.name);
      setDescription(existing.description);
      setPrimaryMuscles(existing.primaryMuscles);
      setSecondaryMuscles(existing.secondaryMuscles);
    }
  }, [existing]);

  function addMuscle(type: 'primary' | 'secondary', muscleId: string) {
    if (!muscleId) return;
    if (type === 'primary') {
      if (!primaryMuscles.includes(muscleId)) {
        setPrimaryMuscles([...primaryMuscles, muscleId]);
      }
    } else {
      if (!secondaryMuscles.includes(muscleId)) {
        setSecondaryMuscles([...secondaryMuscles, muscleId]);
      }
    }
  }

  function removeMuscle(type: 'primary' | 'secondary', muscleId: string) {
    if (type === 'primary') {
      setPrimaryMuscles(primaryMuscles.filter(m => m !== muscleId));
    } else {
      setSecondaryMuscles(secondaryMuscles.filter(m => m !== muscleId));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      description: description.trim(),
      primaryMuscles,
      secondaryMuscles,
    };

    if (isEditing && exerciseId) {
      await updateExercise(exerciseId, data);
    } else {
      await createExercise(data);
    }
    navigate('/exercises');
  }

  // Available muscles (not yet selected)
  const availablePrimary = muscleGroups.filter(m => !primaryMuscles.includes(m.id));
  const availableSecondary = muscleGroups.filter(m => !secondaryMuscles.includes(m.id));

  return (
    <div>
      <PageHeader
        title={isEditing ? 'Oefening bewerken' : 'Nieuwe oefening'}
        backTo="/exercises"
      />
      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="exercise-name">Naam *</Label>
          <Input
            id="exercise-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder="bv. Barbell Back Squat"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="exercise-description">Beschrijving</Label>
          <textarea
            id="exercise-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            placeholder="Optionele beschrijving..."
          />
        </div>

        {/* Primary muscles */}
        <div className="space-y-2">
          <Label>Primaire spiergroepen</Label>
          <div className="flex flex-wrap gap-1 min-h-[28px]">
            {primaryMuscles.map(m => (
              <MuscleChip key={m} muscleId={m} type="primary" onRemove={() => removeMuscle('primary', m)} />
            ))}
          </div>
          <select
            value=""
            onChange={e => addMuscle('primary', e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">+ Spiergroep toevoegen</option>
            {availablePrimary.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Secondary muscles */}
        <div className="space-y-2">
          <Label>Secundaire spiergroepen</Label>
          <div className="flex flex-wrap gap-1 min-h-[28px]">
            {secondaryMuscles.map(m => (
              <MuscleChip key={m} muscleId={m} type="secondary" onRemove={() => removeMuscle('secondary', m)} />
            ))}
          </div>
          <select
            value=""
            onChange={e => addMuscle('secondary', e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">+ Spiergroep toevoegen</option>
            {availableSecondary.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <Button type="submit" className="w-full">
          {isEditing ? 'Opslaan' : 'Aanmaken'}
        </Button>
      </form>
    </div>
  );
}
