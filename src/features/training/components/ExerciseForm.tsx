import { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { createExercise, updateExercise } from '../hooks/useExercises';
import { getMuscleGroups } from '../db/muscles';
import { useSettings } from '../../../hooks/useSettings';
import { MuscleChip } from './MuscleChip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clampRest, formatRest, movementDefaultRest } from '../lib/restTime';
import {
  detectEquipment,
  weightStepFor,
  weightStepKey,
  weightStepLabel,
  WEIGHT_STEP_PRESETS,
} from '../lib/weightStep';
import type { Equipment, Exercise, WeightStepSetting } from '../../../db/index';

const WEIGHT_STEP_OPTIONS = WEIGHT_STEP_PRESETS.map((step) => ({
  key: weightStepKey(step),
  step,
  label: weightStepLabel(step),
}));

const LATERALITY_OPTIONS = [
  { value: '', label: 'Onbekend' },
  { value: 'bilateral', label: 'Bilateraal' },
  { value: 'unilateral', label: 'Unilateraal' },
] as const;

const MOVEMENT_OPTIONS = [
  { value: '', label: 'Onbekend' },
  { value: 'compound', label: 'Compound' },
  { value: 'isolation', label: 'Isolatie' },
] as const;

const EQUIPMENT_OPTIONS = [
  { value: 'cable', label: 'Cable' },
  { value: 'dumbbell', label: 'Halter' },
  { value: 'plates', label: 'Schijven / barbell' },
  { value: 'other', label: 'Overig' },
] as const;

/** Small inline "+" that opens the native picker to add a muscle group. */
function MusclePicker({
  available,
  onSelect,
}: {
  available: { id: string; name: string }[];
  onSelect: (id: string) => void;
}) {
  if (available.length === 0) return null;
  return (
    <div className="relative inline-flex">
      <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full" tabIndex={-1}>
        <Plus className="h-4 w-4" />
      </Button>
      <select
        aria-label="Spiergroep toevoegen"
        value=""
        onChange={e => {
          onSelect(e.target.value);
          e.currentTarget.value = '';
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="" disabled>
          Kies spiergroep
        </option>
        {available.map(m => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A labelled button that cycles through a small set of options on tap. */
function CycleField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const idx = options.findIndex(o => o.value === value);
  const current = options[idx >= 0 ? idx : 0]!;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-center"
        onClick={() => onChange(options[(Math.max(0, idx) + 1) % options.length]!.value)}
      >
        {current.label}
      </Button>
    </div>
  );
}

interface ExerciseFormProps {
  /** When set, the form edits this exercise instead of creating a new one. */
  existing?: Exercise;
  /** Prefill the name field for a new exercise (e.g. a search term). */
  initialName?: string;
  /** Called with the created/updated exercise id after a successful save. */
  onSaved: (exerciseId: number) => void;
  /** Label for the submit button. Defaults based on create/edit mode. */
  submitLabel?: string;
}

/**
 * The full exercise create/edit form (name, muscles, laterality, movement type,
 * equipment, weight step, rest). Used both by the standalone form page and
 * inline while adding an exercise to an active workout.
 */
export function ExerciseForm({ existing, initialName, onSaved, submitLabel }: ExerciseFormProps) {
  const isEditing = existing !== undefined;

  const [name, setName] = useState(initialName ?? '');
  const [description, setDescription] = useState('');
  const [primaryMuscles, setPrimaryMuscles] = useState<string[]>([]);
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);
  const [laterality, setLaterality] = useState<'' | 'bilateral' | 'unilateral'>('');
  const [movementType, setMovementType] = useState<'' | 'compound' | 'isolation'>('');
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [equipment, setEquipment] = useState<Equipment>('other');
  // null = inherit the equipment's configured increment.
  const [weightStep, setWeightStep] = useState<WeightStepSetting | null>(null);
  // Once the user picks equipment manually we stop auto-detecting from the text.
  const equipmentTouched = useRef(false);

  const settings = useSettings();
  const muscleGroups = getMuscleGroups(settings.muscleDetailLevel);
  const initialized = useRef(false);

  useEffect(() => {
    if (existing && !initialized.current) {
      initialized.current = true;
      setName(existing.name);
      setDescription(existing.description);
      setPrimaryMuscles(existing.primaryMuscles);
      setSecondaryMuscles(existing.secondaryMuscles);
      setLaterality(existing.laterality ?? '');
      setMovementType(existing.movementType ?? '');
      setRestSeconds(existing.restTimerSeconds ?? null);
      setEquipment(existing.equipment ?? detectEquipment(`${existing.name} ${existing.description}`));
      setWeightStep(existing.weightStep ?? null);
      equipmentTouched.current = true; // keep the saved/derived value; don't auto-flip it
    }
  }, [existing]);

  // For a new exercise, keep equipment in sync with the name/description until
  // the user overrides it manually.
  useEffect(() => {
    if (isEditing || equipmentTouched.current) return;
    setEquipment(detectEquipment(`${name} ${description}`));
  }, [isEditing, name, description]);

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
      laterality: laterality === '' ? undefined : laterality,
      movementType: movementType === '' ? undefined : movementType,
      equipment,
      weightStep: weightStep ?? undefined,
      restTimerSeconds: restSeconds ?? undefined,
    };

    if (isEditing && existing?.id) {
      await updateExercise(existing.id, data);
      onSaved(existing.id);
    } else {
      const newId = await createExercise(data);
      onSaved(newId);
    }
  }

  // Available muscles (not yet selected)
  const availablePrimary = muscleGroups.filter(m => !primaryMuscles.includes(m.id));
  const availableSecondary = muscleGroups.filter(m => !secondaryMuscles.includes(m.id));

  // Inherited rest time shown as placeholder when no per-exercise override is set.
  const inheritedRest = movementDefaultRest(
    laterality === '' ? undefined : laterality,
    movementType === '' ? undefined : movementType,
    settings,
  );

  function stepRest(delta: number) {
    setRestSeconds(prev => clampRest((prev ?? inheritedRest) + delta));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          rows={5}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          placeholder="Optionele beschrijving..."
        />
      </div>

      {/* Primary muscles */}
      <div className="space-y-2">
        <Label>Primaire spiergroepen</Label>
        <div className="flex flex-wrap items-center gap-1 min-h-[28px]">
          {primaryMuscles.map(m => (
            <MuscleChip key={m} muscleId={m} type="primary" onRemove={() => removeMuscle('primary', m)} />
          ))}
          <MusclePicker available={availablePrimary} onSelect={id => addMuscle('primary', id)} />
        </div>
      </div>

      {/* Secondary muscles */}
      <div className="space-y-2">
        <Label>Secundaire spiergroepen</Label>
        <div className="flex flex-wrap items-center gap-1 min-h-[28px]">
          {secondaryMuscles.map(m => (
            <MuscleChip key={m} muscleId={m} type="secondary" onRemove={() => removeMuscle('secondary', m)} />
          ))}
          <MusclePicker available={availableSecondary} onSelect={id => addMuscle('secondary', id)} />
        </div>
      </div>

      {/* E1-06 laterality + movement type as compact toggles */}
      <div className="grid grid-cols-2 gap-3">
        <CycleField
          label="Belasting"
          value={laterality}
          options={LATERALITY_OPTIONS}
          onChange={v => setLaterality(v as '' | 'bilateral' | 'unilateral')}
        />
        <CycleField
          label="Type"
          value={movementType}
          options={MOVEMENT_OPTIONS}
          onChange={v => setMovementType(v as '' | 'compound' | 'isolation')}
        />
      </div>

      {/* Equipment: drives the default weight increment used by the +/- steppers */}
      <CycleField
        label="Materiaal"
        value={equipment}
        options={EQUIPMENT_OPTIONS}
        onChange={v => {
          equipmentTouched.current = true;
          setEquipment(v as Equipment);
        }}
      />

      {/* Per-exercise weight increment override (defaults to the equipment's step) */}
      <div className="space-y-2">
        <Label htmlFor="weight-step">Gewichtsstap</Label>
        <select
          id="weight-step"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={weightStep ? weightStepKey(weightStep) : ''}
          onChange={e => {
            const found = WEIGHT_STEP_OPTIONS.find(o => o.key === e.target.value);
            setWeightStep(found?.step ?? null);
          }}
        >
          <option value="">
            Materiaalstandaard ({weightStepLabel(weightStepFor(settings.weightSteps, equipment))})
          </option>
          {WEIGHT_STEP_OPTIONS.map(o => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* E1-07: per-exercise default rest */}
      <div className="space-y-2">
        <Label>Standaard rust tussen sets</Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={(restSeconds ?? inheritedRest) <= 15}
            onClick={() => stepRest(-15)}
          >
            -
          </Button>
          <div className="w-14 text-center font-medium tabular-nums">
            {restSeconds !== null ? (
              formatRest(restSeconds)
            ) : (
              <span className="text-muted-foreground">{formatRest(inheritedRest)}</span>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={(restSeconds ?? inheritedRest) >= 600}
            onClick={() => stepRest(15)}
          >
            +
          </Button>
          {restSeconds !== null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-1 h-8 px-2 text-xs text-muted-foreground"
              onClick={() => setRestSeconds(null)}
            >
              Reset
            </Button>
          ) : (
            <span className="ml-1 text-xs text-muted-foreground">standaard</span>
          )}
        </div>
      </div>

      <Button type="submit" className="w-full">
        {submitLabel ?? (isEditing ? 'Opslaan' : 'Aanmaken')}
      </Button>
    </form>
  );
}
