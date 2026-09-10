import Dexie, { type EntityTable } from 'dexie';

// --- Sync metadata ---

/**
 * Fields every synchronised record carries so the offline-first sync engine can
 * reconcile devices (see `docs/design.multi-user-sync.md`).
 * - `clientUpdatedAt`: epoch ms of the last local write; basis for last-write-wins.
 * - `deleted`: tombstone flag — deletes are soft so they propagate on sync.
 * - `dirty`: 1 when changed locally since the last successful push, else 0.
 */
export interface SyncMeta {
  clientUpdatedAt: number;
  deleted: boolean;
  dirty: 0 | 1;
}

/**
 * Generates a record id that is valid both locally and as a PocketBase record id
 * (15 lowercase-alphanumeric chars). Client-generated so local id == server id,
 * which keeps the sync engine simple. Used for all synced entity ids; ids that
 * only live inside JSON (schema day ids, superset groups) may stay UUIDs.
 */
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  let s = '';
  for (let i = 0; i < 15; i++) s += ID_ALPHABET[bytes[i]! % 36];
  return s;
}

/** Stamp for a brand-new local write: current time, not deleted, needs pushing. */
export function freshSyncMeta(now = Date.now()): SyncMeta {
  return { clientUpdatedAt: now, deleted: false, dirty: 1 };
}

/**
 * Patch to merge into an existing record on any local update, so the change is
 * picked up by the next sync (bumps the last-write time and marks it dirty).
 */
export function touchSyncMeta(now = Date.now()): { clientUpdatedAt: number; dirty: 1 } {
  return { clientUpdatedAt: now, dirty: 1 };
}

/**
 * Soft-delete a record: mark it as a tombstone so the deletion syncs to other
 * devices. Reads filter these out. Use instead of `table.delete(id)`.
 */
export function tombstonePatch(now = Date.now()): { deleted: true; clientUpdatedAt: number; dirty: 1 } {
  return { deleted: true, clientUpdatedAt: now, dirty: 1 };
}

// --- Types ---

export interface MuscleGroup {
  id: string;       // e.g. 'chest', 'quadriceps'
  name: string;
  category: string; // global group name, e.g. 'Borst' for both 'Borst' (global) and 'Bovenste borst' (detailed)
  level: 'global' | 'detailed';
}

export interface Exercise extends SyncMeta {
  id: string;
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
  exerciseId: string;
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

export interface TrainingSchema extends SyncMeta {
  id: string;
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
  exerciseId: string;
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
  /**
   * For unilateral exercises each planned set is logged per side, so its sets
   * alternate 'left'/'right'. Undefined for bilateral exercises (single set).
   */
  side?: 'left' | 'right';
}

export interface WorkoutExercise {
  exerciseId: string;
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

export interface Workout extends SyncMeta {
  id: string;
  schemaId: string | null;    // null = ad-hoc
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

export interface BodyWeightEntry extends SyncMeta {
  id: string;
  date: string;        // YYYY-MM-DD
  weightKg: number;
  note?: string;
  createdAt: Date;
}

// --- Habits ---

/** How often a habit is expected. Weekday index convention: 0=Mon … 6=Sun. */
export type HabitSchedule =
  | { kind: 'daily' }
  | { kind: 'interval'; everyDays: number; anchor: string } // anchor = YYYY-MM-DD
  | { kind: 'weekdays'; days: number[] }                    // 0=Mon … 6=Sun
  | { kind: 'monthdays'; days: number[] };                  // 1 … 31

/**
 * `boolean` = done/not done, `count` = a small tally you step up/down, `amount`
 * = a numeric value you type in (e.g. 160 g protein) measured against a target.
 */
export type HabitType = 'boolean' | 'count' | 'amount';

export interface Habit extends SyncMeta {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  type: HabitType;
  /** Target for `count`/`amount` habits (≥1). Ignored for `boolean`. */
  target?: number;
  /** Optional unit shown next to `amount` values, e.g. "g", "ml", "km". */
  unit?: string;
  schedule: HabitSchedule;
  order: number;
  archived: boolean;
  createdAt: Date;
}

export interface HabitLog extends SyncMeta {
  id: string;
  habitId: string;
  date: string;   // YYYY-MM-DD (local)
  value: number;  // 0/1 for boolean, the counted/entered amount otherwise
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
  /**
   * Time (seconds) reserved between exercises for tidy-up + setup of the next
   * one. Used by the schema time estimate.
   */
  exerciseTransitionSeconds: number;
  /**
   * Sync metadata. Settings stays a local singleton (id=1) but syncs as one
   * per-user record; `deleted` is not meaningful here so we only track the
   * last-write time and the dirty flag. Optional for rows saved before v17.
   */
  clientUpdatedAt?: number;
  dirty?: 0 | 1;
}

// --- Database ---

class TrackerDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  schemas!: EntityTable<TrainingSchema, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  bodyWeights!: EntityTable<BodyWeightEntry, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  habitLogs!: EntityTable<HabitLog, 'id'>;

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
        exerciseTransitionSeconds: 45,
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

    // Habit tracker: daily habits + per-day logs (no data migration needed).
    this.version(16).stores({
      habits: '++id, order, archived',
      habitLogs: '++id, habitId, date, [habitId+date]',
    });

    // -----------------------------------------------------------------------
    // Multi-user sync: switch from device-local auto-increment number keys to
    // client-generated string ids, and add sync metadata to every record.
    // See `docs/design.multi-user-sync.md`.
    //
    // IndexedDB cannot change a store's primary key in place, so we do it in
    // four steps: (17) stash all rows — transformed to the new shape — into a
    // temp store; (18) drop the old stores; (19) recreate them with string
    // keys and restore from the stash; (20) drop the temp store.
    // -----------------------------------------------------------------------
    this.version(17).stores({
      // Keep the existing stores so we can still read them here, plus a temp
      // holder keyed by table name.
      exercises: '++id, name, *primaryMuscles, *secondaryMuscles',
      schemas: '++id, name',
      workouts: '++id, status, startedAt, schemaId, schemaDayId',
      bodyWeights: '++id, date',
      habits: '++id, order, archived',
      habitLogs: '++id, habitId, date, [habitId+date]',
      _syncMigration: 'table',
    }).upgrade(async tx => {
      const now = Date.now();
      const meta = () => ({ clientUpdatedAt: now, deleted: false, dirty: 1 as const });

      // Read everything up front.
      const [exercises, schemas, workouts, bodyWeights, habits, habitLogs] =
        await Promise.all([
          tx.table('exercises').toArray(),
          tx.table('schemas').toArray(),
          tx.table('workouts').toArray(),
          tx.table('bodyWeights').toArray(),
          tx.table('habits').toArray(),
          tx.table('habitLogs').toArray(),
        ]);

      // old numeric id -> new string id
      const exId = new Map<number, string>();
      for (const e of exercises) {
        exId.set(e.id, e.isDefault ? defaultExerciseId(e.name) : newId());
      }
      const habitId = new Map<number, string>();
      for (const h of habits) habitId.set(h.id, newId());

      const remapEx = (id: number): string => exId.get(id) ?? String(id);

      const newExercises = exercises.map(e => ({ ...e, id: exId.get(e.id)!, ...meta(), dirty: (e.isDefault ? 0 : 1) as 0 | 1 }));

      const newSchemas = schemas.map(s => ({
        ...s,
        id: newId(),
        exercises: (s.exercises ?? []).map((x: { exerciseId: number }) => ({ ...x, exerciseId: remapEx(x.exerciseId) })),
        days: s.days?.map((d: { exercises: { exerciseId: number }[] }) => ({
          ...d,
          exercises: d.exercises.map(x => ({ ...x, exerciseId: remapEx(x.exerciseId) })),
        })),
        ...meta(),
      }));

      const newWorkouts = workouts.map(w => ({
        ...w,
        id: newId(),
        schemaId: null, // legacy numeric schema link no longer resolves; history keeps schemaName
        exercises: (w.exercises ?? []).map((x: { exerciseId: number; sets: { exerciseId: number }[] }) => ({
          ...x,
          exerciseId: remapEx(x.exerciseId),
          sets: x.sets.map(st => ({ ...st, exerciseId: remapEx(st.exerciseId) })),
        })),
        ...meta(),
      }));

      const newBodyWeights = bodyWeights.map(b => ({ ...b, id: newId(), ...meta() }));
      const newHabits = habits.map(h => ({ ...h, id: habitId.get(h.id)!, ...meta() }));
      const newHabitLogs = habitLogs.map(l => ({
        ...l,
        id: newId(),
        habitId: habitId.get(l.habitId) ?? String(l.habitId),
        ...meta(),
      }));

      await tx.table('_syncMigration').bulkPut([
        { table: 'exercises', rows: newExercises },
        { table: 'schemas', rows: newSchemas },
        { table: 'workouts', rows: newWorkouts },
        { table: 'bodyWeights', rows: newBodyWeights },
        { table: 'habits', rows: newHabits },
        { table: 'habitLogs', rows: newHabitLogs },
      ]);

      // Stamp the settings singleton with sync metadata.
      await tx.table('settings').toCollection().modify(s => {
        if (s.clientUpdatedAt === undefined) s.clientUpdatedAt = now;
        if (s.dirty === undefined) s.dirty = 1;
      });
    });

    // Drop the old number-keyed stores (data already stashed in _syncMigration).
    this.version(18).stores({
      exercises: null,
      schemas: null,
      workouts: null,
      bodyWeights: null,
      habits: null,
      habitLogs: null,
    });

    // Recreate the stores with string primary keys + sync indexes, then restore.
    this.version(19).stores({
      exercises: 'id, name, dirty, *primaryMuscles, *secondaryMuscles',
      schemas: 'id, name, dirty',
      workouts: 'id, status, startedAt, schemaId, schemaDayId, dirty',
      bodyWeights: 'id, date, dirty',
      habits: 'id, order, archived, dirty',
      habitLogs: 'id, habitId, date, [habitId+date], dirty',
    }).upgrade(async tx => {
      const stash = await tx.table('_syncMigration').toArray();
      for (const { table, rows } of stash) {
        if (rows.length > 0) await tx.table(table).bulkPut(rows);
      }
    });

    // Drop the temp store.
    this.version(20).stores({ _syncMigration: null });
  }
}

/**
 * Deterministic, stable string id for a seeded default exercise. Every device
 * seeds defaults with the same id so synced schemas/workouts that reference a
 * default resolve everywhere (defaults themselves are never synced). See
 * `docs/design.multi-user-sync.md`.
 */
export function defaultExerciseId(name: string): string {
  return 'def-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
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
