import { db, type Exercise, UNILATERAL_DEFAULT_EXERCISES } from '../../../db/index';

/**
 * Seed data: 25 common exercises with muscle group mappings (E1-02).
 * Uses global muscle group IDs.
 */
const DEFAULT_EXERCISES: Omit<Exercise, 'id' | 'createdAt'>[] = [
  // Compound movements
  {
    name: 'Barbell Back Squat',
    description: 'Compound beenbeweging met barbell op de bovenrug.',
    primaryMuscles: ['quadriceps', 'glutes'],
    secondaryMuscles: ['hamstrings', 'core'],
    isDefault: true,
  },
  {
    name: 'Barbell Bench Press',
    description: 'Compound borstbeweging liggend op een bank.',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    isDefault: true,
  },
  {
    name: 'Conventional Deadlift',
    description: 'Compound trek vanaf de grond.',
    primaryMuscles: ['back', 'hamstrings'],
    secondaryMuscles: ['glutes', 'core', 'quadriceps'],
    isDefault: true,
  },
  {
    name: 'Overhead Press',
    description: 'Barbell schouderpers staand.',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps', 'core'],
    isDefault: true,
  },
  {
    name: 'Barbell Row',
    description: 'Horizontale trek met barbell, gebukt.',
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps', 'core'],
    isDefault: true,
  },
  // Chest
  {
    name: 'Incline Dumbbell Press',
    description: 'Borstpers op schuine bank met dumbbells.',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['shoulders', 'triceps'],
    isDefault: true,
  },
  {
    name: 'Cable Fly',
    description: 'Borstisolatie met kabels.',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    isDefault: true,
  },
  {
    name: 'Dips',
    description: 'Compound duw op parallelle stangen.',
    primaryMuscles: ['chest', 'triceps'],
    secondaryMuscles: ['shoulders'],
    isDefault: true,
  },
  // Back
  {
    name: 'Pull-up',
    description: 'Verticale trek met lichaamsgewicht.',
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps'],
    isDefault: true,
  },
  {
    name: 'Lat Pulldown',
    description: 'Verticale trek aan kabelstation.',
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps'],
    isDefault: true,
  },
  {
    name: 'Seated Cable Row',
    description: 'Horizontale kabelrij zittend.',
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps'],
    isDefault: true,
  },
  {
    name: 'Face Pull',
    description: 'Kabeloefening voor achterste schouder en bovenrug.',
    primaryMuscles: ['shoulders', 'back'],
    secondaryMuscles: [],
    isDefault: true,
  },
  // Shoulders
  {
    name: 'Lateral Raise',
    description: 'Isolatie voor zijschouder met dumbbells.',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: [],
    isDefault: true,
  },
  // Arms
  {
    name: 'Barbell Curl',
    description: 'Bicepscurl met barbell.',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    isDefault: true,
  },
  {
    name: 'Hammer Curl',
    description: 'Bicepscurl met neutrale grip.',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    isDefault: true,
  },
  {
    name: 'Tricep Pushdown',
    description: 'Tricepsisolatie aan kabel.',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    isDefault: true,
  },
  {
    name: 'Skull Crusher',
    description: 'Tricepsisolatie liggend met EZ-bar.',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    isDefault: true,
  },
  // Legs
  {
    name: 'Romanian Deadlift',
    description: 'Hamstring-focus deadlift met gestrekte benen.',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['back'],
    isDefault: true,
  },
  {
    name: 'Leg Press',
    description: 'Compound beenpers op machine.',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    isDefault: true,
  },
  {
    name: 'Leg Curl',
    description: 'Hamstringisolatie op machine.',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: [],
    isDefault: true,
  },
  {
    name: 'Leg Extension',
    description: 'Quadricepsisolatie op machine.',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: [],
    isDefault: true,
  },
  {
    name: 'Bulgarian Split Squat',
    description: 'Unilaterale squat met achtervoet verhoogd.',
    primaryMuscles: ['quadriceps', 'glutes'],
    secondaryMuscles: ['hamstrings', 'core'],
    isDefault: true,
  },
  {
    name: 'Hip Thrust',
    description: 'Bilspierisolatie met barbell.',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    isDefault: true,
  },
  // Calves
  {
    name: 'Standing Calf Raise',
    description: 'Kuitoefening staand.',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    isDefault: true,
  },
  // Core
  {
    name: 'Hanging Leg Raise',
    description: 'Core-oefening hangend aan een bar.',
    primaryMuscles: ['core'],
    secondaryMuscles: [],
    isDefault: true,
  },
];

export async function seedDatabase(): Promise<void> {
  const count = await db.exercises.count();
  if (count > 0) return; // Already seeded

  const now = new Date();
  const exercises = DEFAULT_EXERCISES.map((e): Omit<Exercise, 'id'> => ({
    ...e,
    // LAT-03: laterality from the shared mapping (unilateral set + bilateral fallback)
    laterality: UNILATERAL_DEFAULT_EXERCISES.has(e.name) ? 'unilateral' : 'bilateral',
    createdAt: now,
  }));

  await db.exercises.bulkAdd(exercises);
}
