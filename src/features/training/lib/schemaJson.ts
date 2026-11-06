import { newId } from '../../../db/index';
import type { SharedDay, SharedExercise, SharedSchema } from './schemaShare';

/**
 * Human- (and AI-) readable schema format. Unlike the compact share format in
 * `schemaShare.ts` (single-letter keys, meant for QR codes) this uses full
 * field names. `docs/schema-format.json` is the JSON Schema of this type; keep
 * the two in sync.
 *
 * Exercises are referenced by NAME (matched case-insensitively against the
 * local exercise library; unknown names become minimal new exercises on
 * import). A schema has either a flat `exercises` list or multiple `days`.
 */
export interface SchemaJsonExercise {
  /** Exercise name, e.g. "Barbell Bench Press". */
  exercise: string;
  sets: number;
  /** Target reps per set; lower bound when `repsMax` is set. */
  reps: number;
  /** Upper bound of a rep range (e.g. reps 8, repsMax 12 → 8–12). */
  repsMax?: number;
  /** Start weight in kg. */
  startWeight?: number;
  /** Rest between sets in seconds. */
  restSeconds?: number;
  /**
   * Label shared by consecutive exercises that form a superset. Any string
   * (or integer, normalised to a string); lone labels are ignored.
   */
  supersetGroup?: string;
  /** Free-text rationale (e.g. why the coach proposed it). Not stored. */
  reason?: string;
}

export interface SchemaJsonDay {
  name: string;
  exercises: SchemaJsonExercise[];
  /** Free-text rationale. Not stored. */
  reason?: string;
}

export interface SchemaJson {
  name: string;
  /** Multi-day schema. Use either `days` or `exercises`, not both. */
  days?: SchemaJsonDay[];
  /** Single-day schema. */
  exercises?: SchemaJsonExercise[];
  /** Training rhythm as day names, e.g. ["Push", "Pull", "Push", "Legs"]. */
  rotation?: string[];
}

export type SchemaJsonResult =
  | {
      ok: true;
      /** Validated, normalised readable form. */
      schema: SchemaJson;
      /** Equivalent compact form, ready for `importSharedSchema`. */
      shared: SharedSchema;
      /** Non-blocking remarks (ignored/unknown fields, ...). */
      warnings: string[];
    }
  | { ok: false; errors: string[] };

const MAX_DAYS = 14;
const MAX_EXERCISES_PER_LIST = 40;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'een lijst';
  if (typeof v === 'string') return `tekst "${v.length > 30 ? `${v.slice(0, 30)}…` : v}"`;
  if (typeof v === 'object') return 'een object';
  return String(v);
}

// --- Parsing raw text ---

/** Strips a surrounding markdown code fence (```json … ```) that AIs love to add. */
function stripFence(text: string): string {
  const t = text.trim();
  const m = /^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?\s*```$/.exec(t);
  return (m ? m[1]! : t).trim();
}

/** Parses pasted/uploaded text and validates it. */
export function parseSchemaJsonText(text: string): SchemaJsonResult {
  const body = stripFence(text);
  if (body === '') return { ok: false, errors: ['Geen JSON gevonden: de invoer is leeg.'] };
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, errors: [`Dit is geen geldige JSON: ${detail}`] };
  }
  return validateSchemaJson(raw);
}

// --- Compact (v: 1) → readable ---

function renameKeys(src: Obj, map: Record<string, string>, drop: string[] = []): Obj {
  const out: Obj = {};
  for (const [k, v] of Object.entries(src)) {
    if (drop.includes(k)) continue;
    out[map[k] ?? k] = v;
  }
  return out;
}

function compactExercise(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  const out = renameKeys(raw, {
    n: 'exercise',
    s: 'sets',
    r: 'reps',
    rm: 'repsMax',
    w: 'startWeight',
    rs: 'restSeconds',
    g: 'supersetGroup',
  });
  return out;
}

function compactList(raw: unknown): unknown {
  return Array.isArray(raw) ? raw.map(compactExercise) : raw;
}

/** Maps the compact share format onto the readable shape (rotation ids → day names). */
function compactToReadable(raw: Obj): Obj {
  const out: Obj = { ...raw };
  delete out.v;
  if ('exercises' in out) out.exercises = compactList(out.exercises);
  if (Array.isArray(raw.days)) {
    const nameById = new Map<string, string>();
    for (const d of raw.days) {
      if (isObj(d) && typeof d.id === 'string' && typeof d.name === 'string') nameById.set(d.id, d.name);
    }
    out.days = raw.days.map(d => {
      if (!isObj(d)) return d;
      const day = renameKeys(d, {}, ['id', 'order']);
      if ('exercises' in day) day.exercises = compactList(day.exercises);
      return day;
    });
    if (Array.isArray(raw.rotation)) {
      out.rotation = raw.rotation.map(id => (typeof id === 'string' ? nameById.get(id) ?? id : id));
    }
  }
  return out;
}

// --- Validation ---

class Collector {
  readonly errors: string[] = [];
  readonly warnings: string[] = [];
  error(path: string, msg: string) {
    this.errors.push(path ? `${path}: ${msg}` : msg);
  }
  warn(path: string, msg: string) {
    this.warnings.push(path ? `${path}: ${msg}` : msg);
  }
}

function warnUnknownKeys(c: Collector, path: string, o: Obj, known: string[]) {
  for (const k of Object.keys(o)) {
    if (!known.includes(k)) c.warn(`${path ? `${path}.` : ''}${k}`, 'onbekend veld, wordt genegeerd');
  }
}

function readNumber(
  c: Collector,
  path: string,
  v: unknown,
  opts: { integer: boolean; min: number; max: number },
): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    c.error(path, `moet een getal zijn (gevonden: ${describe(v)})`);
    return undefined;
  }
  if (opts.integer && !Number.isInteger(v)) {
    c.error(path, `moet een geheel getal zijn (gevonden: ${v})`);
    return undefined;
  }
  if (v < opts.min || v > opts.max) {
    c.error(path, `moet tussen ${opts.min} en ${opts.max} liggen (gevonden: ${v})`);
    return undefined;
  }
  return v;
}

function validateExercise(c: Collector, path: string, raw: unknown): SchemaJsonExercise | undefined {
  if (!isObj(raw)) {
    c.error(path, `moet een object zijn (gevonden: ${describe(raw)})`);
    return undefined;
  }
  const before = c.errors.length;
  warnUnknownKeys(c, path, raw, [
    'exercise', 'sets', 'reps', 'repsMax', 'startWeight', 'restSeconds', 'supersetGroup', 'reason',
  ]);

  let exercise = '';
  if (typeof raw.exercise !== 'string' || raw.exercise.trim() === '') {
    c.error(`${path}.exercise`, 'ontbreekt of is leeg; geef de naam van de oefening als tekst');
  } else {
    exercise = raw.exercise.trim();
    if (exercise.length > 100) c.error(`${path}.exercise`, 'naam is te lang (maximaal 100 tekens)');
  }

  const sets = 'sets' in raw
    ? readNumber(c, `${path}.sets`, raw.sets, { integer: true, min: 1, max: 20 })
    : (c.error(`${path}.sets`, 'ontbreekt (aantal sets, geheel getal)'), undefined);
  const reps = 'reps' in raw
    ? readNumber(c, `${path}.reps`, raw.reps, { integer: true, min: 1, max: 100 })
    : (c.error(`${path}.reps`, 'ontbreekt (herhalingen per set, geheel getal)'), undefined);

  const out: SchemaJsonExercise = { exercise, sets: sets ?? 0, reps: reps ?? 0 };

  if (raw.repsMax != null) {
    const repsMax = readNumber(c, `${path}.repsMax`, raw.repsMax, { integer: true, min: 1, max: 100 });
    if (repsMax != null && reps != null) {
      if (repsMax < reps) c.error(`${path}.repsMax`, `moet minimaal gelijk zijn aan reps (${reps}), gevonden: ${repsMax}`);
      else if (repsMax > reps) out.repsMax = repsMax;
    }
  }
  if (raw.startWeight != null) {
    const w = readNumber(c, `${path}.startWeight`, raw.startWeight, { integer: false, min: 0, max: 1000 });
    if (w != null) out.startWeight = w;
  }
  if (raw.restSeconds != null) {
    const r = readNumber(c, `${path}.restSeconds`, raw.restSeconds, { integer: true, min: 0, max: 3600 });
    if (r != null) out.restSeconds = r;
  }
  if (raw.supersetGroup != null) {
    const g = raw.supersetGroup;
    if (typeof g === 'string' && g.trim() !== '') out.supersetGroup = g.trim();
    else if (typeof g === 'number' && Number.isInteger(g)) out.supersetGroup = String(g);
    else c.error(`${path}.supersetGroup`, `moet een niet-lege tekst of geheel getal zijn (gevonden: ${describe(g)})`);
  }
  if (raw.reason != null) {
    if (typeof raw.reason === 'string') out.reason = raw.reason;
    else c.error(`${path}.reason`, `moet tekst zijn (gevonden: ${describe(raw.reason)})`);
  }

  return c.errors.length === before ? out : undefined;
}

function validateExerciseList(c: Collector, path: string, raw: unknown): SchemaJsonExercise[] | undefined {
  if (!Array.isArray(raw)) {
    c.error(path, `moet een lijst met oefeningen zijn (gevonden: ${describe(raw)})`);
    return undefined;
  }
  if (raw.length === 0) {
    c.error(path, 'bevat geen oefeningen');
    return undefined;
  }
  if (raw.length > MAX_EXERCISES_PER_LIST) {
    c.error(path, `bevat te veel oefeningen (maximaal ${MAX_EXERCISES_PER_LIST}, gevonden: ${raw.length})`);
    return undefined;
  }
  const out: SchemaJsonExercise[] = [];
  let ok = true;
  raw.forEach((item, i) => {
    const ex = validateExercise(c, `${path}[${i}]`, item);
    if (ex) out.push(ex);
    else ok = false;
  });

  // Supersets are adjacency based: a label may only occur in one consecutive run.
  if (ok) {
    const closed = new Set<string>();
    let i = 0;
    while (i < out.length) {
      const g = out[i]!.supersetGroup;
      let j = i;
      if (g) while (j + 1 < out.length && out[j + 1]!.supersetGroup === g) j++;
      if (g) {
        if (closed.has(g)) {
          c.error(`${path}[${i}].supersetGroup`, `groep "${g}" staat niet aaneengesloten; oefeningen in een superset moeten direct na elkaar staan`);
        }
        closed.add(g);
        if (j === i) c.warn(`${path}[${i}].supersetGroup`, `groep "${g}" heeft maar één oefening en wordt genegeerd`);
      }
      i = j + 1;
    }
  }
  return ok ? out : undefined;
}

/** Validates raw parsed JSON (readable or compact `v: 1` format). */
export function validateSchemaJson(input: unknown): SchemaJsonResult {
  if (!isObj(input)) {
    return { ok: false, errors: [`De JSON moet een object zijn met o.a. "name" en "exercises" of "days" (gevonden: ${describe(input)}).`] };
  }

  let raw: Obj = input;
  if ('v' in input) {
    if (input.v !== 1) {
      return { ok: false, errors: [`v: onbekende formaatversie (${describe(input.v)}); alleen 1 wordt ondersteund. Laat "v" weg om het leesbare formaat te gebruiken.`] };
    }
    raw = compactToReadable(input);
  }

  const c = new Collector();
  warnUnknownKeys(c, '', raw, ['name', 'days', 'exercises', 'rotation', '$schema']);

  let name = '';
  if (typeof raw.name !== 'string' || raw.name.trim() === '') {
    c.error('name', 'ontbreekt of is leeg; geef het schema een naam als tekst');
  } else {
    name = raw.name.trim();
    if (name.length > 100) c.error('name', 'naam is te lang (maximaal 100 tekens)');
  }

  const hasDays = raw.days != null;
  const hasFlat = raw.exercises != null;
  const schema: SchemaJson = { name };

  if (hasDays && hasFlat) {
    c.error('', 'gebruik óf "days" óf "exercises", niet allebei');
  } else if (!hasDays && !hasFlat) {
    c.error('', 'er ontbreekt een "exercises"-lijst (één trainingsdag) of een "days"-lijst (meerdere dagen)');
  } else if (hasFlat) {
    const list = validateExerciseList(c, 'exercises', raw.exercises);
    if (list) schema.exercises = list;
    if (raw.rotation != null) c.warn('rotation', 'alleen zinvol bij "days", wordt genegeerd');
  } else {
    const days = raw.days;
    if (!Array.isArray(days)) {
      c.error('days', `moet een lijst met dagen zijn (gevonden: ${describe(days)})`);
    } else if (days.length === 0) {
      c.error('days', 'bevat geen dagen');
    } else if (days.length > MAX_DAYS) {
      c.error('days', `bevat te veel dagen (maximaal ${MAX_DAYS}, gevonden: ${days.length})`);
    } else {
      const outDays: SchemaJsonDay[] = [];
      const seen = new Set<string>();
      let ok = true;
      days.forEach((d, i) => {
        const path = `days[${i}]`;
        if (!isObj(d)) {
          c.error(path, `moet een object zijn (gevonden: ${describe(d)})`);
          ok = false;
          return;
        }
        warnUnknownKeys(c, path, d, ['name', 'exercises', 'reason']);
        const before = c.errors.length;
        let dayName = '';
        if (typeof d.name !== 'string' || d.name.trim() === '') {
          c.error(`${path}.name`, 'ontbreekt of is leeg; geef de dag een naam (bijv. "Push")');
        } else {
          dayName = d.name.trim();
          const key = dayName.toLowerCase();
          if (seen.has(key)) c.error(`${path}.name`, `dagnaam "${dayName}" komt dubbel voor; dagnamen moeten uniek zijn`);
          seen.add(key);
        }
        const exercises = validateExerciseList(c, `${path}.exercises`, d.exercises);
        const day: SchemaJsonDay = { name: dayName, exercises: exercises ?? [] };
        if (d.reason != null) {
          if (typeof d.reason === 'string') day.reason = d.reason;
          else c.error(`${path}.reason`, `moet tekst zijn (gevonden: ${describe(d.reason)})`);
        }
        if (c.errors.length === before) outDays.push(day);
        else ok = false;
      });
      if (ok) schema.days = outDays;

      if (raw.rotation != null) {
        if (!Array.isArray(raw.rotation)) {
          c.error('rotation', `moet een lijst met dagnamen zijn (gevonden: ${describe(raw.rotation)})`);
        } else if (ok) {
          const dayNames = new Set(outDays.map(d => d.name.toLowerCase()));
          const rotation: string[] = [];
          (raw.rotation as unknown[]).forEach((r, i) => {
            if (typeof r !== 'string') {
              c.error(`rotation[${i}]`, `moet een dagnaam (tekst) zijn (gevonden: ${describe(r)})`);
            } else if (!dayNames.has(r.trim().toLowerCase())) {
              c.error(`rotation[${i}]`, `"${r}" is geen dag in "days" (beschikbaar: ${outDays.map(d => `"${d.name}"`).join(', ')})`);
            } else {
              rotation.push(outDays.find(d => d.name.toLowerCase() === r.trim().toLowerCase())!.name);
            }
          });
          if (rotation.length > 0) schema.rotation = rotation;
        }
      }
    }
  }

  if (c.errors.length > 0) return { ok: false, errors: c.errors };
  return { ok: true, schema, shared: toSharedSchema(schema), warnings: c.warnings };
}

// --- Mapping to the internal (compact) import path ---

function toSharedList(list: SchemaJsonExercise[]): SharedExercise[] {
  // A superset needs ≥2 adjacent members; lone labels are dropped.
  const counts = new Map<string, number>();
  for (const e of list) if (e.supersetGroup) counts.set(e.supersetGroup, (counts.get(e.supersetGroup) ?? 0) + 1);
  const groupIndex = new Map<string, number>();
  return list.map(e => {
    let g: number | undefined;
    if (e.supersetGroup && (counts.get(e.supersetGroup) ?? 0) >= 2) {
      if (!groupIndex.has(e.supersetGroup)) groupIndex.set(e.supersetGroup, groupIndex.size);
      g = groupIndex.get(e.supersetGroup);
    }
    return {
      n: e.exercise,
      s: e.sets,
      r: e.reps,
      ...(e.repsMax != null ? { rm: e.repsMax } : {}),
      ...(e.startWeight != null ? { w: e.startWeight } : {}),
      ...(e.restSeconds != null ? { rs: e.restSeconds } : {}),
      ...(g != null ? { g } : {}),
    };
  });
}

/** Converts a validated `SchemaJson` into the compact form `importSharedSchema` takes. */
export function toSharedSchema(schema: SchemaJson): SharedSchema {
  if (schema.days && schema.days.length > 0) {
    const days: SharedDay[] = schema.days.map((d, i) => ({
      id: newId(),
      name: d.name,
      order: i,
      exercises: toSharedList(d.exercises),
    }));
    const idByName = new Map(days.map(d => [d.name.toLowerCase(), d.id]));
    const rotation = (schema.rotation ?? [])
      .map(n => idByName.get(n.toLowerCase()))
      .filter((id): id is string => id != null);
    return { v: 1, name: schema.name, days, ...(rotation.length > 0 ? { rotation } : {}) };
  }
  return { v: 1, name: schema.name, exercises: toSharedList(schema.exercises ?? []) };
}

// --- Helpers for the import screen ---

/** All exercise lists of a schema as one flat array. */
export function allExercises(schema: SchemaJson): SchemaJsonExercise[] {
  return schema.days && schema.days.length > 0
    ? schema.days.flatMap(d => d.exercises)
    : schema.exercises ?? [];
}

/**
 * Distinct exercise names (original spelling, first occurrence) that don't
 * exist in the library yet — the import would create these as new exercises.
 */
export function findUnknownExercises(schema: SchemaJson, knownNames: Iterable<string>): string[] {
  const known = new Set<string>();
  for (const n of knownNames) known.add(n.trim().toLowerCase());
  const seen = new Set<string>();
  const unknown: string[] = [];
  for (const e of allExercises(schema)) {
    const key = e.exercise.trim().toLowerCase();
    if (known.has(key) || seen.has(key)) continue;
    seen.add(key);
    unknown.push(e.exercise);
  }
  return unknown;
}

/** Short prescription text, e.g. "3×8–12 · 60 kg · rust 90 s". */
export function formatPrescription(e: SchemaJsonExercise): string {
  const reps = e.repsMax != null && e.repsMax > e.reps ? `${e.reps}–${e.repsMax}` : `${e.reps}`;
  const parts = [`${e.sets}×${reps}`];
  if (e.startWeight != null) parts.push(`${e.startWeight} kg`);
  if (e.restSeconds != null) parts.push(`rust ${e.restSeconds} s`);
  return parts.join(' · ');
}
