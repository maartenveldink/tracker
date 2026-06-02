import Dexie, { type EntityTable } from 'dexie';

// --- Types ---

export interface MuscleGroup {
  id: string;       // e.g. 'chest', 'quadriceps'
  name: string;
  category: string; // global group name, e.g. 'Borst' for both 'Borst' (global) and 'Bovenste borst' (detailed)
  level: 'global' | 'detailed';
}

export interface Exercise {
  id?: number;
  name: string;
  description: string;
  primaryMuscles: string[];   // MuscleGroup ids
  secondaryMuscles: string[]; // MuscleGroup ids
  isDefault: boolean;         // true = from seed data
  createdAt: Date;
}

export interface SchemaExercise {
  exerciseId: number;
  sets: number;
  repsPerSet: number;
  order: number;
}

export interface TrainingSchema {
  id?: number;
  name: string;
  exercises: SchemaExercise[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkoutSet {
  exerciseId: number;
  setNumber: number;
  plannedReps: number | null;
  actualReps: number | null;
  weight: number | null;
  completed: boolean;
  skipped: boolean;
}

export interface WorkoutExercise {
  exerciseId: number;
  order: number;
  sets: WorkoutSet[];
  notes: string;
}

export type WorkoutStatus = 'active' | 'paused' | 'completed';

export interface Workout {
  id?: number;
  schemaId: number | null;    // null = ad-hoc
  schemaName: string | null;
  exercises: WorkoutExercise[];
  status: WorkoutStatus;
  startedAt: Date;
  pausedAt: Date | null;
  totalPausedMs: number;
  completedAt: Date | null;
  notes: string;
}

// --- Database ---

class TrackerDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  schemas!: EntityTable<TrainingSchema, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;

  constructor() {
    super('TrackerDB');

    this.version(1).stores({
      exercises: '++id, name, *primaryMuscles, *secondaryMuscles',
      schemas: '++id, name',
      workouts: '++id, status, startedAt, schemaId',
    });
  }
}

export const db = new TrackerDB();
