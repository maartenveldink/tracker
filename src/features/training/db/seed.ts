import { db, defaultExerciseId, type Exercise, UNILATERAL_DEFAULT_EXERCISES, COMPOUND_DEFAULT_EXERCISES, DEFAULT_EXERCISE_EQUIPMENT } from '../../../db/index';
import { detectEquipment } from '../lib/weightStep';

/**
 * Seed data: 25 common exercises with muscle group mappings (E1-02).
 * Uses global muscle group IDs.
 */
const DEFAULT_EXERCISES: Omit<Exercise, 'id' | 'createdAt' | 'clientUpdatedAt' | 'deleted' | 'dirty'>[] = [
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
  // --- Aanvullingen: dekken gaten in de standaardbibliotheek ---
  {
    name: 'Seated Calf Raise',
    description: 'Kuitoefening zittend; legt meer nadruk op de soleus.',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    isDefault: true,
  },
  {
    name: 'Hip Abduction',
    description: 'Bilspierisolatie op de abductiemachine (heup naar buiten).',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    isDefault: true,
  },
  {
    name: 'Lying Leg Curl',
    description: 'Hamstringisolatie liggend op de machine.',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: [],
    isDefault: true,
  },
  {
    name: 'Good Morning',
    description: 'Voorover buigen met barbell op de rug; hamstrings en onderrug.',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['back', 'glutes'],
    isDefault: true,
  },
  {
    name: 'T-Bar Row',
    description: 'Horizontale trek met de T-bar, gebukt.',
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps'],
    isDefault: true,
  },
  {
    name: 'Chest-Supported Row',
    description: 'Rijen met de borst ondersteund op een schuine bank/machine.',
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps'],
    isDefault: true,
  },
  {
    name: 'Barbell Shrug',
    description: 'Schouders optrekken met barbell; trapezius.',
    primaryMuscles: ['back'],
    secondaryMuscles: ['shoulders'],
    isDefault: true,
  },
  {
    name: 'Front Raise',
    description: 'Isolatie voor de voorste schouder met dumbbells.',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: [],
    isDefault: true,
  },
  {
    name: 'Upright Row',
    description: 'Verticale trek langs het lichaam; schouders en bovenrug.',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['back'],
    isDefault: true,
  },
  {
    name: 'Single Arm Cable Row',
    description: 'Eenarmige horizontale kabelrij; rug per zijde.',
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps'],
    isDefault: true,
  },
  // --- Aanvullingen op basis van bestaand trainingsschema ---
  {
    name: 'Front Squat',
    description: 'Squat met het gewicht vóór het lichaam; quad-focus.',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: ['glutes', 'core'],
    isDefault: true,
  },
  {
    name: 'Back Extension',
    description: 'Hyperextensie op de bank; onderrug, bilspieren en hamstrings.',
    primaryMuscles: ['back'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    isDefault: true,
  },
  {
    name: 'Arnold Press',
    description: 'Schouderpers met draaiende dumbbells (Arnold-variant).',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps'],
    isDefault: true,
  },
  {
    name: 'Around The World',
    description: 'Dumbbells in een boog van heup naar boven; schouders en borst.',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['chest'],
    isDefault: true,
  },
  {
    name: 'Single-Arm Dumbbell Shoulder Press',
    description: 'Eenarmige schouderpers met dumbbell; per zijde.',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps'],
    isDefault: true,
  },
  {
    name: 'Overhead Tricep Extension',
    description: 'Triceps-extensie boven het hoofd met dumbbell.',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    isDefault: true,
  },
  {
    name: 'Close-Grip Dumbbell Press',
    description: 'Bankdruk met dumbbells dicht bij elkaar; borst en triceps.',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps'],
    isDefault: true,
  },
  {
    name: 'Lat Pulldown (Behind Neck)',
    description: 'Lat pulldown met de stang achter de nek.',
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps'],
    isDefault: true,
  },
  {
    name: 'Walking Lunge',
    description: 'Lopende uitvalspas met dumbbells/kettlebells; per been.',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    isDefault: true,
  },
  // --- Extra core- en biceps-oefeningen ---
  {
    name: 'Plank',
    description: 'Isometrische core-oefening; houd de plankpositie vast.',
    primaryMuscles: ['core'],
    secondaryMuscles: [],
    isDefault: true,
  },
  {
    name: 'Cable Crunch',
    description: 'Core-crunch knielend aan het kabelstation.',
    primaryMuscles: ['core'],
    secondaryMuscles: [],
    isDefault: true,
  },
  {
    name: 'Russian Twist',
    description: 'Zittende romprotatie voor de schuine buikspieren.',
    primaryMuscles: ['core'],
    secondaryMuscles: [],
    isDefault: true,
  },
  {
    name: 'Preacher Curl',
    description: 'Bicepscurl met de bovenarm op de preacher-bank.',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    isDefault: true,
  },
  {
    name: 'Concentration Curl',
    description: 'Eenarmige bicepscurl met de elleboog op het bovenbeen.',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    isDefault: true,
  },
];

export async function seedDatabase(): Promise<void> {
  // Additive & idempotent: add only the default exercises that aren't present
  // yet (matched on their deterministic id). This seeds a fresh install and also
  // lets existing users pick up newly-shipped defaults, without touching their
  // edits or reviving defaults they deleted (a tombstone keeps the id present).
  const existingIds = new Set((await db.exercises.toArray()).map((e) => e.id));

  const now = new Date();
  const exercises = DEFAULT_EXERCISES.map((e): Exercise => ({
    ...e,
    // Deterministic, stable id so every device seeds identical default ids and
    // synced schemas/workouts that reference them resolve everywhere.
    id: defaultExerciseId(e.name),
    // LAT-03: laterality from the shared mapping (unilateral set + bilateral fallback)
    laterality: UNILATERAL_DEFAULT_EXERCISES.has(e.name) ? 'unilateral' : 'bilateral',
    // Movement type from the shared mapping (compound set + isolation fallback)
    movementType: COMPOUND_DEFAULT_EXERCISES.has(e.name) ? 'compound' : 'isolation',
    // Equipment: curated per default exercise, keyword-detected as fallback
    equipment: DEFAULT_EXERCISE_EQUIPMENT[e.name] ?? detectEquipment(`${e.name} ${e.description}`),
    createdAt: now,
    // Defaults are never synced (filtered by isDefault), so they start clean.
    clientUpdatedAt: now.getTime(),
    deleted: false,
    dirty: 0,
  })).filter((e) => !existingIds.has(e.id));

  if (exercises.length > 0) await db.exercises.bulkPut(exercises);
}
