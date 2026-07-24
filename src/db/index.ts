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
  /** Optional per-exercise default rest time (seconds). Falls back to the global setting. */
  restTimerSeconds?: number;
  /**
   * Optional laterality of the movement. Drives a smarter default rest time:
   * bilateral (heavier, both limbs at once) gets extra rest. Undefined = unknown.
   */
  laterality?: 'bilateral' | 'unilateral';
  /** Optional movement type: compound (multi-joint) or isolation. Undefined = unknown. */
  movementType?: 'compound' | 'isolation';
  /**
   * Optional equipment type, which drives the weight increment used by the
   * +/- steppers (see `features/training/lib/weightStep.ts`). Undefined falls
   * back to the "other" 1 kg step.
   */
  equipment?: Equipment;
  /**
   * Optional per-exercise weight increment for the +/- steppers. Overrides the
   * equipment-based default from `AppSettings.weightSteps`. Undefined = inherit.
   */
  weightStep?: WeightStepSetting;
}

/** Equipment an exercise is loaded with; determines its weight increment. */
export type Equipment = 'cable' | 'dumbbell' | 'plates' | 'other';

/** Unit a weight increment is expressed in. */
export type WeightUnit = 'kg' | 'lb';

/** A configurable weight increment (e.g. 2.5 kg, or 2.5 lb). */
export interface WeightStepSetting {
  value: number;
  unit: WeightUnit;
}

export interface SchemaExercise {
  exerciseId: number;
  /** Lower bound / target reps per set. */
  repsPerSet: number;
  sets: number;
  /**
   * Optional upper bound for a rep range. When set and greater than
   * `repsPerSet`, the exercise prescribes a range (e.g. 8–12 reps).
   * Undefined means a fixed rep count of `repsPerSet`.
   */
  repsMax?: number;
  /**
   * Optional starting weight (kg) used the first time this schema is trained.
   * Defaults to a suggestion derived from the latest registered 1RM and the
   * lower bound of the rep range; can be manually overridden.
   */
  startWeight?: number;
  /**
   * Optional rest time (seconds) between sets for this exercise within this
   * schema. Undefined means it inherits from the exercise/laterality/global
   * default (see rest resolution order in the workout page).
   */
  restSeconds?: number;
  /**
   * Optional superset grouping. Consecutive exercises sharing the same non-empty
   * `supersetGroup` are performed as a superset (one set each, alternating).
   */
  supersetGroup?: string;
  order: number;
}

export interface SchemaDay {
  id: string;       // unique within the schema (e.g. crypto.randomUUID())
  name: string;     // user-defined name (e.g. "Push", "Pull", "Legs")
  exercises: SchemaExercise[];
  order: number;
}

export interface TrainingSchema {
  id?: number;
  name: string;
  /** Legacy flat exercise list — used when days is undefined/empty (single-day schema). */
  exercises: SchemaExercise[];
  /** Multi-day schemas store exercises per day. When set, `exercises` is ignored. */
  days?: SchemaDay[];
  /**
   * Optional repetition rhythm for multi-day schemas: an ordered list of day IDs
   * that defines the training cycle (e.g. [A, B, A, C]). A day ID may appear more
   * than once. When undefined/empty, days rotate in plain `order` sequence.
   */
  rotation?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkoutSet {
  exerciseId: number;
  setNumber: number;
  plannedReps: number | null;
  /** Optional upper bound when the schema prescribed a rep range (e.g. 8–12). */
  plannedRepsMax?: number;
  /** Optional planned weight (kg) seeded from the schema's start weight. */
  plannedWeight?: number;
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
  /** Optional rest (seconds) snapshotted from the schema exercise when the workout started. */
  restSeconds?: number;
  /**
   * Optional superset grouping snapshotted from the schema. Consecutive exercises
   * sharing the same non-empty value are trained as a superset (alternating sets).
   */
  supersetGroup?: string;
}

export type WorkoutStatus = 'active' | 'paused' | 'completed';

export interface Workout {
  id?: number;
  schemaId: number | null;    // null = ad-hoc
  schemaName: string | null;
  schemaDayId: string | null; // null = ad-hoc or single-day schema
  schemaDayName: string | null;
  exercises: WorkoutExercise[];
  status: WorkoutStatus;
  startedAt: Date;
  pausedAt: Date | null;
  totalPausedMs: number;
  completedAt: Date | null;
  notes: string;
}

export interface BodyWeightEntry {
  id?: number;
  date: string;        // YYYY-MM-DD
  weightKg: number;
  note?: string;
  createdAt: Date;
}

// --- App Settings ---

/** Sizing/spacing of the live-workout set controls (buttons + inputs). */
export type WorkoutDensity = 'compact' | 'comfortable' | 'spacious';

export interface AppSettings {
  id: 1; // singleton row
  oneRMFormula: 'epley' | 'brzycki' | 'lombardi';
  muscleDetailLevel: 'global' | 'detailed';
  /** How large/roomy the workout set controls are rendered. */
  workoutDensity: WorkoutDensity;
  restTimerSeconds: number; // RT-05: default rest timer duration (15–600, step 15)
  /** Weight increment per equipment type for the +/- weight buttons. */
  weightSteps: Record<Equipment, WeightStepSetting>;
  /** Default rest (seconds) per laterality × movement-type combination. */
  restDefaults: {
    bilateralCompound: number;
    unilateralCompound: number;
    bilateralIsolation: number;
    unilateralIsolation: number;
  };
  /** E3-12: vibrate when the rest timer ends. */
  restTimerVibrate: boolean;
  /** E3-12: play a sound when the rest timer ends. */
  restTimerSound: boolean;
}

// --- Database ---

class TrackerDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  schemas!: EntityTable<TrainingSchema, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  bodyWeights!: EntityTable<BodyWeightEntry, 'id'>;

  constructor() {
    super('TrackerDB');

    this.version(1).stores({
      exercises: '++id, name, *primaryMuscles, *secondaryMuscles',
      schemas: '++id, name',
      workouts: '++id, status, startedAt, schemaId',
    });

    // E2-08: multi-day schemas — add schemaDayId to workouts for day tracking
    this.version(2).stores({
      exercises: '++id, name, *primaryMuscles, *secondaryMuscles',
      schemas: '++id, name',
      workouts: '++id, status, startedAt, schemaId, schemaDayId',
    }).upgrade(tx => {
      return tx.table('workouts').toCollection().modify(workout => {
        if (workout.schemaDayId === undefined) workout.schemaDayId = null;
        if (workout.schemaDayName === undefined) workout.schemaDayName = null;
      });
    });

    // Epic 5+6: nutrition module — foods, recipes, daily log
    this.version(3).stores({
      exercises: '++id, name, *primaryMuscles, *secondaryMuscles',
      schemas: '++id, name',
      workouts: '++id, status, startedAt, schemaId, schemaDayId',
      foods: '++id, name',
      recipes: '++id, name',
      dailyLog: '++id, date, itemType, itemId',
    });

    // E8-04: persistent settings — migrate macroGoals from localStorage
    this.version(4).stores({
      exercises: '++id, name, *primaryMuscles, *secondaryMuscles',
      schemas: '++id, name',
      workouts: '++id, status, startedAt, schemaId, schemaDayId',
      foods: '++id, name',
      recipes: '++id, name',
      dailyLog: '++id, date, itemType, itemId',
      settings: 'id',
    }).upgrade(async tx => {
      const defaults: AppSettings = {
        id: 1,
        oneRMFormula: 'epley',
        muscleDetailLevel: 'global',
        workoutDensity: 'comfortable',
        restTimerSeconds: 90,
        weightSteps: {
          cable: { value: 5, unit: 'lb' },
          dumbbell: { value: 2, unit: 'kg' },
          plates: { value: 1.25, unit: 'kg' },
          other: { value: 1, unit: 'kg' },
        },
        restDefaults: {
          bilateralCompound: 180,
          unilateralCompound: 90,
          bilateralIsolation: 60,
          unilateralIsolation: 15,
        },
        restTimerVibrate: true,
        restTimerSound: true,
      };

      await tx.table('settings').put(defaults);
    });

    // RT-05: add restTimerSeconds to settings
    this.version(5).stores({
      exercises: '++id, name, *primaryMuscles, *secondaryMuscles',
      schemas: '++id, name',
      workouts: '++id, status, startedAt, schemaId, schemaDayId',
      foods: '++id, name',
      recipes: '++id, name',
      dailyLog: '++id, date, itemType, itemId',
      settings: 'id',
    }).upgrade(async tx => {
      await tx.table('settings').toCollection().modify(s => {
        if (s.restTimerSeconds === undefined) s.restTimerSeconds = 90;
      });
    });

    // Epic 9: week planner
    this.version(6).stores({
      exercises: '++id, name, *primaryMuscles, *secondaryMuscles',
      schemas: '++id, name',
      workouts: '++id, status, startedAt, schemaId, schemaDayId',
      foods: '++id, name',
      recipes: '++id, name',
      dailyLog: '++id, date, itemType, itemId',
      settings: 'id',
      weekPlans: '++id, name',
    });

    // Epic 7: Google Health integration — tokens + daily health data
    this.version(7).stores({
      exercises: '++id, name, *primaryMuscles, *secondaryMuscles',
      schemas: '++id, name',
      workouts: '++id, status, startedAt, schemaId, schemaDayId',
      foods: '++id, name',
      recipes: '++id, name',
      dailyLog: '++id, date, itemType, itemId',
      settings: 'id',
      weekPlans: '++id, name',
      googleHealthConnection: 'id',
      googleHealthData: '++id, date',
    });

    // Rest-time refinement: laterality-based default rest + configurable bilateral offset
    this.version(8).stores({
      exercises: '++id, name, *primaryMuscles, *secondaryMuscles',
      schemas: '++id, name',
      workouts: '++id, status, startedAt, schemaId, schemaDayId',
      foods: '++id, name',
      recipes: '++id, name',
      dailyLog: '++id, date, itemType, itemId',
      settings: 'id',
      weekPlans: '++id, name',
      googleHealthConnection: 'id',
      googleHealthData: '++id, date',
    }).upgrade(async tx => {
      // E8-09: add the configurable bilateral rest offset
      await tx.table('settings').toCollection().modify(s => {
        if (s.bilateralRestExtraSeconds === undefined) s.bilateralRestExtraSeconds = 60;
      });
      // MIG-02: backfill laterality on the seeded default exercises by name
      await tx.table('exercises').toCollection().modify(e => {
        if (e.isDefault && e.laterality === undefined) {
          e.laterality = UNILATERAL_DEFAULT_EXERCISES.has(e.name) ? 'unilateral' : 'bilateral';
        }
      });
    });

    // Bodyweight tracking: log body weight over time
    this.version(9).stores({
      exercises: '++id, name, *primaryMuscles, *secondaryMuscles',
      schemas: '++id, name',
      workouts: '++id, status, startedAt, schemaId, schemaDayId',
      foods: '++id, name',
      recipes: '++id, name',
      dailyLog: '++id, date, itemType, itemId',
      settings: 'id',
      weekPlans: '++id, name',
      googleHealthConnection: 'id',
      googleHealthData: '++id, date',
      bodyWeights: '++id, date',
    });

    // Rest timer alerts: vibrate + sound toggles
    this.version(10).stores({
      exercises: '++id, name, *primaryMuscles, *secondaryMuscles',
      schemas: '++id, name',
      workouts: '++id, status, startedAt, schemaId, schemaDayId',
      foods: '++id, name',
      recipes: '++id, name',
      dailyLog: '++id, date, itemType, itemId',
      settings: 'id',
      weekPlans: '++id, name',
      googleHealthConnection: 'id',
      googleHealthData: '++id, date',
      bodyWeights: '++id, date',
    }).upgrade(async tx => {
      await tx.table('settings').toCollection().modify(s => {
        if (s.restTimerVibrate === undefined) s.restTimerVibrate = true;
        if (s.restTimerSound === undefined) s.restTimerSound = true;
      });
    });

    // Exercise movement type (compound / isolation)
    this.version(11).stores({
      exercises: '++id, name, *primaryMuscles, *secondaryMuscles',
      schemas: '++id, name',
      workouts: '++id, status, startedAt, schemaId, schemaDayId',
      foods: '++id, name',
      recipes: '++id, name',
      dailyLog: '++id, date, itemType, itemId',
      settings: 'id',
      weekPlans: '++id, name',
      googleHealthConnection: 'id',
      googleHealthData: '++id, date',
      bodyWeights: '++id, date',
    }).upgrade(async tx => {
      // Backfill movementType on the seeded default exercises by name
      await tx.table('exercises').toCollection().modify(e => {
        if (e.isDefault && e.movementType === undefined) {
          e.movementType = COMPOUND_DEFAULT_EXERCISES.has(e.name) ? 'compound' : 'isolation';
        }
      });
    });

    // Laterality × movement-type rest defaults (replaces the bilateral offset)
    this.version(12).stores({
      exercises: '++id, name, *primaryMuscles, *secondaryMuscles',
      schemas: '++id, name',
      workouts: '++id, status, startedAt, schemaId, schemaDayId',
      foods: '++id, name',
      recipes: '++id, name',
      dailyLog: '++id, date, itemType, itemId',
      settings: 'id',
      weekPlans: '++id, name',
      googleHealthConnection: 'id',
      googleHealthData: '++id, date',
      bodyWeights: '++id, date',
    }).upgrade(async tx => {
      await tx.table('settings').toCollection().modify(s => {
        if (s.restDefaults === undefined) {
          s.restDefaults = {
            bilateralCompound: 180,
            unilateralCompound: 90,
            bilateralIsolation: 60,
            unilateralIsolation: 15,
          };
        }
      });
    });

    // Per-exercise equipment type (drives the weight increment)
    this.version(13).stores({
      exercises: '++id, name, *primaryMuscles, *secondaryMuscles',
      schemas: '++id, name',
      workouts: '++id, status, startedAt, schemaId, schemaDayId',
      foods: '++id, name',
      recipes: '++id, name',
      dailyLog: '++id, date, itemType, itemId',
      settings: 'id',
      weekPlans: '++id, name',
      googleHealthConnection: 'id',
      googleHealthData: '++id, date',
      bodyWeights: '++id, date',
    }).upgrade(async tx => {
      // Backfill equipment: curated mapping for seeded defaults, keyword
      // detection for everything else.
      await tx.table('exercises').toCollection().modify(e => {
        if (e.equipment === undefined) {
          const curated = e.isDefault ? DEFAULT_EXERCISE_EQUIPMENT[e.name] : undefined;
          e.equipment = curated ?? detectEquipmentFromText(`${e.name} ${e.description}`);
        }
      });
    });

    // Configurable weight increment per equipment type
    this.version(14).stores({
      exercises: '++id, name, *primaryMuscles, *secondaryMuscles',
      schemas: '++id, name',
      workouts: '++id, status, startedAt, schemaId, schemaDayId',
      foods: '++id, name',
      recipes: '++id, name',
      dailyLog: '++id, date, itemType, itemId',
      settings: 'id',
      weekPlans: '++id, name',
      googleHealthConnection: 'id',
      googleHealthData: '++id, date',
      bodyWeights: '++id, date',
    }).upgrade(async tx => {
      await tx.table('settings').toCollection().modify(s => {
        if (s.weightSteps === undefined) {
          s.weightSteps = {
            cable: { value: 5, unit: 'lb' },
            dumbbell: { value: 2, unit: 'kg' },
            plates: { value: 1.25, unit: 'kg' },
            other: { value: 1, unit: 'kg' },
          };
        }
      });
    });

    // Drop the removed nutrition, planner and Google Health modules. Setting a
    // store to null deletes it (and its data) on upgrade.
    this.version(15).stores({
      foods: null,
      recipes: null,
      dailyLog: null,
      weekPlans: null,
      googleHealthConnection: null,
      googleHealthData: null,
    }).upgrade(async tx => {
      await tx.table('settings').toCollection().modify(s => {
        delete s.macroGoals;
        delete s.features;
      });
    });
  }
}

/**
 * Best-guess equipment from an exercise's name + description. Kept inline here
 * (rather than importing the feature lib) to preserve the db → feature layering.
 * Mirrors `features/training/lib/weightStep.ts#detectEquipment`.
 */
function detectEquipmentFromText(text: string): Equipment {
  const t = text.toLowerCase();
  if (t.includes('cable') || t.includes('kabel')) return 'cable';
  if (t.includes('barbell') || t.includes('halterschijf') || t.includes('halterschijven')) return 'plates';
  if (t.includes('dumbbell') || t.includes('halter')) return 'dumbbell';
  return 'other';
}

/**
 * Names of seeded default exercises that train one limb at a time. Everything
 * else in the default library is a bilateral barbell/cable/machine movement.
 * Used by the v8 backfill migration (MIG-02).
 */
export const UNILATERAL_DEFAULT_EXERCISES = new Set<string>([
  'Bulgarian Split Squat',
]);

/**
 * Names of seeded default exercises that are compound (multi-joint) movements.
 * Everything else in the default library is treated as isolation.
 * Used by the v11 backfill migration and by the seed.
 */
export const COMPOUND_DEFAULT_EXERCISES = new Set<string>([
  'Barbell Back Squat',
  'Barbell Bench Press',
  'Conventional Deadlift',
  'Overhead Press',
  'Barbell Row',
  'Incline Dumbbell Press',
  'Dips',
  'Pull-up',
  'Lat Pulldown',
  'Seated Cable Row',
  'Romanian Deadlift',
  'Leg Press',
  'Bulgarian Split Squat',
  'Hip Thrust',
]);

/**
 * Curated equipment (weight-increment class) per seeded default exercise. Used
 * by the seed and the v13 backfill so defaults get a sensible increment instead
 * of falling back to keyword detection. Plate-loaded machines are grouped under
 * 'plates' since they progress in the same 1.25 kg micro-plate steps.
 * Names not listed fall back to `detectEquipment` on the name + description.
 */
export const DEFAULT_EXERCISE_EQUIPMENT: Record<string, Equipment> = {
  // Cable / pulley stations
  'Cable Fly': 'cable',
  'Lat Pulldown': 'cable',
  'Seated Cable Row': 'cable',
  'Face Pull': 'cable',
  'Tricep Pushdown': 'cable',
  // Dumbbell (halter)
  'Incline Dumbbell Press': 'dumbbell',
  'Lateral Raise': 'dumbbell',
  'Hammer Curl': 'dumbbell',
  'Bulgarian Split Squat': 'dumbbell',
  // Barbell / EZ-bar / plate-loaded (halterschijven)
  'Barbell Back Squat': 'plates',
  'Barbell Bench Press': 'plates',
  'Conventional Deadlift': 'plates',
  'Overhead Press': 'plates',
  'Barbell Row': 'plates',
  'Barbell Curl': 'plates',
  'Skull Crusher': 'plates',
  'Romanian Deadlift': 'plates',
  'Leg Press': 'plates',
  'Hip Thrust': 'plates',
  'Standing Calf Raise': 'plates',
  'Leg Curl': 'plates',
  'Leg Extension': 'plates',
  // Bodyweight (overig, 1 kg add-on steps)
  'Dips': 'other',
  'Pull-up': 'other',
  'Hanging Leg Raise': 'other',
};

export const db = new TrackerDB();
