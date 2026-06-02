import { db, type Workout, type AppSettings } from '../../../db/index';
import { seedDatabase } from './seed';

const SETTINGS_DEFAULTS: AppSettings = {
  id: 1,
  oneRMFormula: 'epley',
  muscleDetailLevel: 'global',
  macroGoals: { calories: null, protein: null, carbs: null, fat: null },
  restTimerSeconds: 90,
};

/**
 * Wipes all data and re-seeds the default exercise library.
 * Called by the "Alles wissen" button in Settings.
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.exercises, db.schemas, db.workouts, db.foods, db.recipes, db.dailyLog, db.settings, db.weekPlans], async () => {
    await db.workouts.clear();
    await db.schemas.clear();
    await db.exercises.clear();
    await db.foods.clear();
    await db.recipes.clear();
    await db.dailyLog.clear();
    await db.weekPlans.clear();
    await db.settings.put(SETTINGS_DEFAULTS);
    // Note: Google Health tokens and health data are NOT cleared here — the user
    // manages that via the dedicated "Ontkoppel Google Health" button (E7-10).
  });
  await seedDatabase();
}

/**
 * Adds a demo "Push A" schema + 13 realistic bench press sessions over ~3 months.
 * Called by the "Laad demodata" button in Settings.
 * Does not check whether data already exists — caller is responsible.
 */
export async function seedDemoData(): Promise<void> {
  // Look up exercises by name (IDs are auto-incremented after seeding)
  const [benchPress, ohp, incline, pushdown, lateralRaise] = await Promise.all([
    db.exercises.where('name').equals('Barbell Bench Press').first(),
    db.exercises.where('name').equals('Overhead Press').first(),
    db.exercises.where('name').equals('Incline Dumbbell Press').first(),
    db.exercises.where('name').equals('Tricep Pushdown').first(),
    db.exercises.where('name').equals('Lateral Raise').first(),
  ]);

  if (!benchPress?.id) throw new Error('Oefening "Barbell Bench Press" niet gevonden. Is de database geseed?');

  // --- Schema ---
  const now = new Date();
  const schemaId = await db.schemas.add({
    name: 'Push A',
    exercises: [
      { exerciseId: benchPress.id, sets: 4, repsPerSet: 8, order: 0 },
      ...(ohp?.id      ? [{ exerciseId: ohp.id,      sets: 3, repsPerSet: 10, order: 1 }] : []),
      ...(incline?.id  ? [{ exerciseId: incline.id,  sets: 3, repsPerSet: 10, order: 2 }] : []),
      ...(pushdown?.id ? [{ exerciseId: pushdown.id, sets: 3, repsPerSet: 12, order: 3 }] : []),
      ...(lateralRaise?.id ? [{ exerciseId: lateralRaise.id, sets: 3, repsPerSet: 15, order: 4 }] : []),
    ],
    createdAt: now,
    updatedAt: now,
  }) as number;

  // --- Bench press workouts ---
  const bpId = benchPress.id;

  const daysAgo = (n: number): Date => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(9, 0, 0, 0);
    return d;
  };

  const mkSet = (setNumber: number, weight: number, reps: number) => ({
    exerciseId: bpId,
    setNumber,
    plannedReps: reps,
    actualReps: reps,
    weight,
    completed: true,
    skipped: false,
  });

  const mkWorkout = (
    daysBack: number,
    sets: ReturnType<typeof mkSet>[],
  ): Omit<Workout, 'id'> => {
    const start = daysAgo(daysBack);
    return {
      schemaId,
      schemaName: 'Push A',
      schemaDayId: null,
      schemaDayName: null,
      exercises: [{ exerciseId: bpId, order: 0, sets, notes: '' }],
      status: 'completed',
      startedAt: start,
      pausedAt: null,
      totalPausedMs: 0,
      completedAt: new Date(start.getTime() + 50 * 60 * 1000),
      notes: '',
    };
  };

  // 13 sessies — progressieve overbelasting (~3 maanden)
  // Epley 1RM = gewicht × (1 + reps/30)
  const sessions: Omit<Workout, 'id'>[] = [
    mkWorkout(91, [mkSet(1,60,5), mkSet(2,60,5), mkSet(3,60,5), mkSet(4,60,5), mkSet(5,60,5)]),       // ~70
    mkWorkout(84, [mkSet(1,62.5,5), mkSet(2,62.5,5), mkSet(3,62.5,5), mkSet(4,62.5,5), mkSet(5,62.5,5)]), // ~72.9
    mkWorkout(77, [mkSet(1,65,5), mkSet(2,65,5), mkSet(3,65,5), mkSet(4,65,5), mkSet(5,65,5)]),        // ~75.8
    mkWorkout(70, [mkSet(1,65,10), mkSet(2,65,10), mkSet(3,65,8)]),                                     // ~86.7
    mkWorkout(63, [mkSet(1,67.5,10), mkSet(2,67.5,10), mkSet(3,67.5,9)]),                               // ~90.0
    mkWorkout(56, [mkSet(1,67.5,5), mkSet(2,67.5,5), mkSet(3,67.5,5), mkSet(4,67.5,5), mkSet(5,67.5,5)]), // ~78.7
    mkWorkout(49, [mkSet(1,70,5), mkSet(2,70,5), mkSet(3,70,5), mkSet(4,70,5), mkSet(5,70,5)]),        // ~81.7
    mkWorkout(42, [mkSet(1,72.5,8), mkSet(2,72.5,8), mkSet(3,72.5,7)]),                                 // ~91.9
    mkWorkout(35, [mkSet(1,75,8), mkSet(2,75,8), mkSet(3,75,8)]),                                       // ~95.0
    mkWorkout(28, [mkSet(1,77.5,5), mkSet(2,77.5,5), mkSet(3,77.5,5)]),                                 // ~90.4
    mkWorkout(21, [mkSet(1,80,5), mkSet(2,80,5), mkSet(3,80,5)]),                                       // ~93.3
    mkWorkout(14, [mkSet(1,82.5,5), mkSet(2,82.5,5), mkSet(3,82.5,4)]),                                 // ~96.3
    mkWorkout(7,  [mkSet(1,85,5), mkSet(2,85,5), mkSet(3,85,5)]),                                       // ~99.2
  ];

  await db.workouts.bulkAdd(sessions);
}
