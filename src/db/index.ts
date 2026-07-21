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

// --- Nutrition Types ---

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Food {
  id?: number;
  name: string;
  servingSize: number;  // grams per serving
  calories: number;     // per serving
  protein: number;      // per serving
  carbs: number;        // per serving
  fat: number;          // per serving
  createdAt: Date;
}

export interface RecipeIngredient {
  foodId: number;
  grams: number;
}

export interface Recipe {
  id?: number;
  name: string;
  ingredients: RecipeIngredient[];
  totalWeight: number;  // computed: sum of ingredient grams
  calories: number;     // computed totals
  protein: number;
  carbs: number;
  fat: number;
  createdAt: Date;
  updatedAt: Date;
}

export type DailyLogItemType = 'food' | 'recipe';

export interface DailyLogEntry {
  id?: number;
  date: string;          // YYYY-MM-DD
  itemType: DailyLogItemType;
  itemId: number;        // food or recipe id
  itemName: string;      // denormalized for display
  grams: number;         // actual grams consumed
  calories: number;      // computed for this entry
  protein: number;
  carbs: number;
  fat: number;
  createdAt: Date;
}

export interface MacroGoals {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

// --- Week Planner Types (Epic 9) ---

export interface WeekPlanDay {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = maandag, 6 = zondag
  schemaId: number | null;    // null = rustdag
  schemaDayId: string | null; // null = single-day schema of rustdag
  label: string | null;       // optioneel override-label, bv. "Push A"
}

export interface WeekPlan {
  id?: number;
  name: string;
  days: WeekPlanDay[]; // 7 entries, een per weekdag
  createdAt: Date;
  updatedAt: Date;
}

// --- Google Health Types (Epic 7) ---

export interface GoogleHealthConnection {
  id: 1; // singleton row
  accountName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in ms
  connectedAt: Date;
  lastSyncAt: Date | null;
  lastSyncError: string | null; // E7-18: last API error message, null when healthy
  consecutiveFailDays: number;  // E7-19: days without a successful sync
}

export interface SleepPhases {
  lightMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  awakeMinutes: number;
}

export interface GoogleHealthDay {
  id?: number;
  date: string;                    // YYYY-MM-DD (wake-up date)
  sleepMinutes: number | null;     // E7-12: total sleep duration
  sleepPhases: SleepPhases | null; // E7-12: breakdown if available
  steps: number | null;            // E7-14
  restingHeartRate: number | null; // E7-15: min bpm of the day
  syncedAt: Date;
}

// --- App Settings ---

export interface AppSettings {
  id: 1; // singleton row
  oneRMFormula: 'epley' | 'brzycki' | 'lombardi';
  muscleDetailLevel: 'global' | 'detailed';
  macroGoals: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  };
  restTimerSeconds: number; // RT-05: default rest timer duration (15–600, step 15)
  /** E8-09: extra rest (seconds) added on top of the global default for bilateral exercises. */
  bilateralRestExtraSeconds: number;
  /** Optional feature modules, hidden from the main navigation when disabled. */
  features: {
    nutrition: boolean;
    planner: boolean;
  };
}

// --- Database ---

class TrackerDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  schemas!: EntityTable<TrainingSchema, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  foods!: EntityTable<Food, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  dailyLog!: EntityTable<DailyLogEntry, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  weekPlans!: EntityTable<WeekPlan, 'id'>;
  googleHealthConnection!: EntityTable<GoogleHealthConnection, 'id'>;
  googleHealthData!: EntityTable<GoogleHealthDay, 'id'>;

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
        macroGoals: { calories: null, protein: null, carbs: null, fat: null },
        restTimerSeconds: 90,
        bilateralRestExtraSeconds: 60,
        features: { nutrition: false, planner: false },
      };

      // Migrate macroGoals from localStorage
      try {
        const stored = localStorage.getItem('tracker_macro_goals');
        if (stored) {
          const parsed = JSON.parse(stored) as AppSettings['macroGoals'];
          defaults.macroGoals = parsed;
          localStorage.removeItem('tracker_macro_goals');
        }
      } catch {
        // ignore parse errors
      }

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
  }
}

/**
 * Names of seeded default exercises that train one limb at a time. Everything
 * else in the default library is a bilateral barbell/cable/machine movement.
 * Used by the v8 backfill migration (MIG-02).
 */
export const UNILATERAL_DEFAULT_EXERCISES = new Set<string>([
  'Bulgarian Split Squat',
]);

export const db = new TrackerDB();
