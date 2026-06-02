import type { MuscleGroup } from '../../../db/index';

/**
 * Standardised muscle group definitions (E1-03).
 * Global level: 8-10 groups (default).
 * Detailed level: 20+ specific muscles, each mapped to a global category.
 */

export const MUSCLE_GROUPS: MuscleGroup[] = [
  // --- Global groups (level: 'global') ---
  { id: 'chest',       name: 'Borst',          category: 'Borst',          level: 'global' },
  { id: 'back',        name: 'Rug',            category: 'Rug',            level: 'global' },
  { id: 'shoulders',   name: 'Schouders',      category: 'Schouders',      level: 'global' },
  { id: 'biceps',      name: 'Biceps',         category: 'Armen',          level: 'global' },
  { id: 'triceps',     name: 'Triceps',        category: 'Armen',          level: 'global' },
  { id: 'core',        name: 'Core',           category: 'Core',           level: 'global' },
  { id: 'quadriceps',  name: 'Quadriceps',     category: 'Bovenbenen',     level: 'global' },
  { id: 'hamstrings',  name: 'Hamstrings',     category: 'Bovenbenen',     level: 'global' },
  { id: 'glutes',      name: 'Bilspieren',     category: 'Bilspieren',     level: 'global' },
  { id: 'calves',      name: 'Kuiten',         category: 'Kuiten',         level: 'global' },

  // --- Detailed muscles (level: 'detailed') ---
  { id: 'upper_chest',       name: 'Bovenste borst',       category: 'Borst',      level: 'detailed' },
  { id: 'lower_chest',       name: 'Onderste borst',       category: 'Borst',      level: 'detailed' },
  { id: 'lats',              name: 'Latissimus dorsi',     category: 'Rug',        level: 'detailed' },
  { id: 'upper_back',        name: 'Bovenrug (traps)',     category: 'Rug',        level: 'detailed' },
  { id: 'lower_back',        name: 'Onderrug',             category: 'Rug',        level: 'detailed' },
  { id: 'rhomboids',         name: 'Rhomboiden',           category: 'Rug',        level: 'detailed' },
  { id: 'front_delts',       name: 'Voorste schouder',     category: 'Schouders',  level: 'detailed' },
  { id: 'side_delts',        name: 'Zijschouder',          category: 'Schouders',  level: 'detailed' },
  { id: 'rear_delts',        name: 'Achterste schouder',   category: 'Schouders',  level: 'detailed' },
  { id: 'biceps_long',       name: 'Biceps (lange kop)',   category: 'Armen',      level: 'detailed' },
  { id: 'biceps_short',      name: 'Biceps (korte kop)',   category: 'Armen',      level: 'detailed' },
  { id: 'triceps_long',      name: 'Triceps (lange kop)',  category: 'Armen',      level: 'detailed' },
  { id: 'triceps_lateral',   name: 'Triceps (laterale kop)', category: 'Armen',    level: 'detailed' },
  { id: 'forearms',          name: 'Onderarmen',           category: 'Armen',      level: 'detailed' },
  { id: 'abs',               name: 'Buikspieren',          category: 'Core',       level: 'detailed' },
  { id: 'obliques',          name: 'Schuine buikspieren',  category: 'Core',       level: 'detailed' },
  { id: 'hip_flexors',       name: 'Heupflexoren',         category: 'Bovenbenen', level: 'detailed' },
  { id: 'adductors',         name: 'Adductoren',           category: 'Bovenbenen', level: 'detailed' },
  { id: 'abductors',         name: 'Abductoren',           category: 'Bovenbenen', level: 'detailed' },
  { id: 'soleus',            name: 'Soleus',               category: 'Kuiten',     level: 'detailed' },
  { id: 'gastrocnemius',     name: 'Gastrocnemius',        category: 'Kuiten',     level: 'detailed' },
];

/** Returns muscle groups filtered by level. Default = global only. */
export function getMuscleGroups(level: 'global' | 'detailed' = 'global'): MuscleGroup[] {
  if (level === 'detailed') {
    return MUSCLE_GROUPS.filter(m => m.level === 'detailed');
  }
  return MUSCLE_GROUPS.filter(m => m.level === 'global');
}

/** Get a single muscle group by id. */
export function getMuscleGroupById(id: string): MuscleGroup | undefined {
  return MUSCLE_GROUPS.find(m => m.id === id);
}

/** Get all global muscle group ids for coverage analysis. */
export function getAllGlobalMuscleIds(): string[] {
  return MUSCLE_GROUPS.filter(m => m.level === 'global').map(m => m.id);
}
