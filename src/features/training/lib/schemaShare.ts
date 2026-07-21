import { db, type TrainingSchema, type SchemaExercise, type SchemaDay } from '../../../db/index';
import { createSchema } from '../hooks/useSchemas';

// A share payload references exercises by NAME, because the numeric exerciseId
// is auto-incremented per device and won't match across devices.

interface SharedExercise {
  n: string; // exercise name
  s: number; // sets
  r: number; // reps per set (lower bound / target)
  rm?: number; // optional upper bound for a rep range
  w?: number; // optional start weight (kg)
}

interface SharedDay {
  id: string;
  name: string;
  order: number;
  exercises: SharedExercise[];
}

export interface SharedSchema {
  v: 1;
  name: string;
  exercises?: SharedExercise[]; // single-day
  days?: SharedDay[];           // multi-day
  rotation?: string[];          // day-id rhythm
}

// --- UTF-8 safe base64url ---

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// --- Encode ---

export function buildSharedSchema(
  schema: TrainingSchema,
  exerciseNameById: Map<number, string>,
): SharedSchema {
  const toShared = (e: SchemaExercise): SharedExercise => ({
    n: exerciseNameById.get(e.exerciseId) ?? 'Onbekend',
    s: e.sets,
    r: e.repsPerSet,
    ...(e.repsMax != null ? { rm: e.repsMax } : {}),
    ...(e.startWeight != null ? { w: e.startWeight } : {}),
  });

  if (schema.days && schema.days.length > 0) {
    return {
      v: 1,
      name: schema.name,
      days: [...schema.days]
        .sort((a, b) => a.order - b.order)
        .map(d => ({
          id: d.id,
          name: d.name,
          order: d.order,
          exercises: d.exercises.map(toShared),
        })),
      rotation: schema.rotation && schema.rotation.length > 0 ? schema.rotation : undefined,
    };
  }

  return { v: 1, name: schema.name, exercises: schema.exercises.map(toShared) };
}

/** Encodes a schema into a share URL for the given app origin+base. */
export function encodeSchemaShareUrl(shared: SharedSchema, baseUrl: string): string {
  const param = toBase64Url(JSON.stringify(shared));
  const origin = window.location.origin;
  // baseUrl is like "/tracker/" or "/"; ensure a single trailing slash join
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${origin}${base}?importSchema=${param}`;
}

// --- Decode ---

export function decodeSchemaParam(param: string): SharedSchema | null {
  try {
    const parsed = JSON.parse(fromBase64Url(param)) as SharedSchema;
    if (parsed.v !== 1 || typeof parsed.name !== 'string') return null;
    if (!Array.isArray(parsed.exercises) && !Array.isArray(parsed.days)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Human-readable summary for the import confirmation. */
export function summarizeSharedSchema(shared: SharedSchema): string {
  if (shared.days && shared.days.length > 0) {
    const total = shared.days.reduce((sum, d) => sum + d.exercises.length, 0);
    return `${shared.days.length} dagen · ${total} oefeningen`;
  }
  const n = shared.exercises?.length ?? 0;
  return `${n} oefening${n !== 1 ? 'en' : ''}`;
}

// --- Import ---

/**
 * Imports a shared schema, resolving exercises by name against the local
 * database and creating any that are missing. Returns the new schema id.
 */
export async function importSharedSchema(shared: SharedSchema): Promise<number> {
  // Build a name -> id map of local exercises (case-insensitive)
  const local = await db.exercises.toArray();
  const idByName = new Map<string, number>();
  for (const ex of local) {
    if (ex.id) idByName.set(ex.name.trim().toLowerCase(), ex.id);
  }

  async function resolveId(name: string): Promise<number> {
    const key = name.trim().toLowerCase();
    const existing = idByName.get(key);
    if (existing) return existing;
    // Create a minimal exercise so the schema stays complete
    const id = (await db.exercises.add({
      name: name.trim(),
      description: '',
      primaryMuscles: [],
      secondaryMuscles: [],
      isDefault: false,
      createdAt: new Date(),
    })) as number;
    idByName.set(key, id);
    return id;
  }

  async function toSchemaExercises(shExs: SharedExercise[]): Promise<SchemaExercise[]> {
    const out: SchemaExercise[] = [];
    for (let i = 0; i < shExs.length; i++) {
      const e = shExs[i]!;
      out.push({
        exerciseId: await resolveId(e.n),
        sets: e.s,
        repsPerSet: e.r,
        ...(e.rm != null ? { repsMax: e.rm } : {}),
        ...(e.w != null ? { startWeight: e.w } : {}),
        order: i,
      });
    }
    return out;
  }

  // Avoid confusing duplicate names
  const existingNames = new Set((await db.schemas.toArray()).map(s => s.name));
  let name = shared.name;
  if (existingNames.has(name)) name = `${name} (geïmporteerd)`;

  if (shared.days && shared.days.length > 0) {
    const days: SchemaDay[] = [];
    for (const d of shared.days) {
      days.push({
        id: d.id,
        name: d.name,
        order: d.order,
        exercises: await toSchemaExercises(d.exercises),
      });
    }
    const validIds = new Set(days.map(d => d.id));
    const rotation = (shared.rotation ?? []).filter(id => validIds.has(id));
    return createSchema(name, [], days, rotation.length > 0 ? rotation : undefined);
  }

  const exercises = await toSchemaExercises(shared.exercises ?? []);
  return createSchema(name, exercises);
}
