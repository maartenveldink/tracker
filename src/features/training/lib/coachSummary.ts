import type {
  BodyWeightEntry,
  Exercise,
  TrainingSchema,
  Workout,
    WorkoutSet,
} from '../../../db/index';
import { getAllGlobalMuscleIds, getMuscleGroupById } from '../db/muscles';
import { calculate1RM, type OneRMFormula } from '../hooks/useProgress';
import { localDateKey } from './metrics';
import { schemaToJson, type SchemaJson } from './schemaJson';

/**
 * Compact, privacy-friendly digest of the last few weeks of training, meant to
 * be pasted into an AI chat ("Kopieer voor AI") or sent to the API.
 *
 * Pure: everything comes in through `CoachSummaryInput`, nothing is read from
 * the database, so it is trivial to test and to reuse (the API client builds on
 * the same function). Deliberately contains NO raw sets, NO absolute dates and
 * NO ids — only aggregates per exercise / week / muscle group and the user's
 * own free-text notes. Weeks are numbered relative to the period: week 1 is the
 * oldest 7 days, week N the most recent 7 days before `now`.
 */

export type CoachPeriodWeeks = 4 | 8;

/** Muscle groups averaging fewer weighted sets per week than this count as undertrained. */
export const UNDERTRAINED_SETS_PER_WEEK = 6;

const WEEK_MS = 7 * 86400000;
const MAX_EXERCISES = 40;
const MAX_NOTES = 25;
const MAX_NOTE_LENGTH = 400;

export interface CoachSummaryInput {
  /** Workouts to digest; non-completed and deleted ones are ignored, so any list may be passed. */
  workouts: Workout[];
  /** The exercise library (also provides the list of existing names). */
  exercises: Exercise[];
  /** The schema under discussion, or null when there is none. */
  schema: TrainingSchema | null;
  bodyWeights?: BodyWeightEntry[];
  weeks: CoachPeriodWeeks;
  oneRMFormula?: OneRMFormula;
  /** Reference "now"; defaults to the current time (injectable for tests). */
  now?: Date;
}

export interface CoachExerciseSession {
  /** Relative week number within the period (1 = oldest). */
  week: number;
  /** Sets actually done (completed with reps). */
  sets: number;
  /** Planned sets that were skipped or never completed. */
  skippedSets: number;
  /** Reps achieved over the done sets, as "8" or "8-10". */
  reps: string | null;
  /** Rep target of the plan, as "8" or "8-12" (null for free workouts). */
  target: string | null;
}

export interface CoachExerciseWeek {
  week: number;
  /** Mean set weight in kg over the weighted sets; null for bodyweight-only. */
  avgKg: number | null;
  /** Σ weight × reps in kg (weighted sets only). */
  volumeKg: number;
  totalReps: number;
}

export interface CoachExerciseSummary {
  name: string;
  /** Number of sessions with this exercise in the period. */
  sessions: number;
  /** Best estimated 1RM of the first and the last session; null without weighted sets. */
  e1rm: { startKg: number; endKg: number; changePct: number | null } | null;
  setsDone: number;
  setsSkipped: number;
  perSession: CoachExerciseSession[];
  perWeek: CoachExerciseWeek[];
}

export interface CoachMuscleSummary {
  muscle: string;
  /** Weighted sets (primary muscle 1 per set, secondary 0.5). */
  sets: number;
  setsPerWeek: number;
  volumeKg: number;
}

export interface CoachSummary {
  period: { weeks: CoachPeriodWeeks; sessions: number; e1rmFormula: OneRMFormula };
  frequency: {
    sessionsPerWeek: number;
    /** Sessions per relative week, oldest first (length = weeks). */
    perWeek: number[];
    weeksWithoutSession: number;
    /** Sessions per schema day / schema name; free workouts under "Vrije training". */
    byDay: Record<string, number>;
    avgDurationMin: number | null;
  };
  currentSchema: SchemaJson | null;
  exercises: CoachExerciseSummary[];
  muscles: CoachMuscleSummary[];
  undertrained: { muscle: string; setsPerWeek: number }[];
  bodyWeight: { entries: number; startKg: number; endKg: number; changeKg: number } | null;
  notes: {
    sessions: { week: number; day: string; text: string }[];
    exercises: { week: number; exercise: string; text: string }[];
  };
  /** Names of every exercise in the library, so the coach prefers existing ones. */
  existingExercises: string[];
}

// --- helpers ---

/** A set that was actually performed: bodyweight sets (weight null/0) count. */
function isDoneSet(s: WorkoutSet): boolean {
  return s.completed && s.actualReps !== null && s.actualReps > 0;
}

/** Unilateral exercises log each planned set as a left+right pair; count each entry as half a set. */
function setCount(sets: WorkoutSet[]): number {
  return sets.reduce((n, s) => n + (s.side ? 0.5 : 1), 0);
}

function hasWeight(s: WorkoutSet): boolean {
  return s.weight !== null && s.weight > 0;
}

function round(n: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function rangeText(min: number, max: number): string {
  return min === max ? `${min}` : `${min}-${max}`;
}

function clip(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > MAX_NOTE_LENGTH ? `${t.slice(0, MAX_NOTE_LENGTH)}…` : t;
}

/** Detailed muscle ids rolled up to the global group they belong to (others keep their own id). */
const DETAILED_TO_GLOBAL: Record<string, string> = {
  hip_flexors: 'quadriceps', adductors: 'quadriceps', abductors: 'glutes',
  upper_chest: 'chest', lower_chest: 'chest',
  lats: 'back', upper_back: 'back', lower_back: 'back', rhomboids: 'back',
  front_delts: 'shoulders', side_delts: 'shoulders', rear_delts: 'shoulders',
  biceps_long: 'biceps', biceps_short: 'biceps',
  triceps_long: 'triceps', triceps_lateral: 'triceps',
  abs: 'core', obliques: 'core',
  soleus: 'calves', gastrocnemius: 'calves',
};

function toGlobalMuscle(id: string): string {
  return DETAILED_TO_GLOBAL[id] ?? id;
}

function muscleName(id: string): string {
  return getMuscleGroupById(id)?.name ?? id;
}

/** Schema day, else schema name, else "Vrije training". */
function dayLabel(w: Workout): string {
  return w.schemaDayName ?? w.schemaName ?? 'Vrije training';
}

function sessionTarget(sets: WorkoutSet[]): string | null {
  const planned = sets.find(s => s.plannedReps != null);
  if (!planned || planned.plannedReps == null) return null;
  const max = planned.plannedRepsMax;
  return rangeText(planned.plannedReps, max != null && max > planned.plannedReps ? max : planned.plannedReps);
}

interface ExerciseAcc {
  name: string;
  /** One entry per workout; an exercise that occurs twice in a workout is merged. */
  sessions: { workoutId: string; started: number; week: number; sets: WorkoutSet[] }[];
}

// --- builder ---

export function buildCoachSummary(input: CoachSummaryInput): CoachSummary {
  const { weeks, schema } = input;
  const formula = input.oneRMFormula ?? 'epley';
  const now = input.now ?? new Date();
  const cutoff = now.getTime() - weeks * WEEK_MS;

  const exerciseById = new Map(input.exercises.map(e => [e.id, e]));
  const nameById = new Map(input.exercises.map(e => [e.id, e.name]));

  const workouts = input.workouts
    .filter(w => w.status === 'completed' && !w.deleted)
    .filter(w => {
      const t = w.startedAt.getTime();
      return t >= cutoff && t <= now.getTime();
    })
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

  const weekOf = (w: Workout): number =>
    Math.min(weeks, Math.floor((w.startedAt.getTime() - cutoff) / WEEK_MS) + 1);

  // Frequency
  const perWeekCount = Array.from({ length: weeks }, () => 0);
  // Null-prototype: day names are free text ("constructor", "__proto__" must not misbehave).
  const byDay: Record<string, number> = Object.create(null) as Record<string, number>;
  const durations: number[] = [];
  for (const w of workouts) {
    perWeekCount[weekOf(w) - 1]! += 1;
    const label = dayLabel(w);
    byDay[label] = (byDay[label] ?? 0) + 1;
    if (w.completedAt) {
      const ms = w.completedAt.getTime() - w.startedAt.getTime() - (w.totalPausedMs ?? 0);
      if (ms > 0 && ms < 6 * 3600000) durations.push(ms / 60000);
    }
  }

  // Per exercise
  const acc = new Map<string, ExerciseAcc>();
  const muscleSets = new Map<string, number>();
  const muscleVolume = new Map<string, number>();
  const sessionNotes: CoachSummary['notes']['sessions'] = [];
  const exerciseNotes: CoachSummary['notes']['exercises'] = [];

  for (const w of workouts) {
    const week = weekOf(w);
    if (w.notes.trim()) {
      sessionNotes.push({ week, day: dayLabel(w), text: clip(w.notes) });
    }
    for (const we of w.exercises) {
      const ex = exerciseById.get(we.exerciseId);
      if (!ex) continue;
      const done = we.sets.filter(isDoneSet);
      if (we.notes.trim()) exerciseNotes.push({ week, exercise: ex.name, text: clip(we.notes) });
      if (we.sets.length === 0) continue;

      const a = acc.get(ex.id) ?? { name: ex.name, sessions: [] };
      const existing = a.sessions.find(x => x.workoutId === w.id);
      if (existing) existing.sets.push(...we.sets);
      else a.sessions.push({ workoutId: w.id, started: w.startedAt.getTime(), week, sets: [...we.sets] });
      acc.set(ex.id, a);

      // Per set, each global muscle group is credited once: primary 1, secondary 0.5.
      const credit = new Map<string, number>();
      for (const m of ex.secondaryMuscles) credit.set(toGlobalMuscle(m), 0.5);
      for (const m of ex.primaryMuscles) credit.set(toGlobalMuscle(m), 1);
      for (const s of done) {
        const n = s.side ? 0.5 : 1;
        const volume = hasWeight(s) ? s.weight! * s.actualReps! : 0;
        for (const [g, factor] of credit) {
          muscleSets.set(g, (muscleSets.get(g) ?? 0) + n * factor);
          muscleVolume.set(g, (muscleVolume.get(g) ?? 0) + volume * factor);
        }
      }
    }
  }

  const exercises: CoachExerciseSummary[] = [];
  for (const a of acc.values()) {
    const sessions = [...a.sessions].sort((x, y) => x.started - y.started);
    const perSession: CoachExerciseSession[] = [];
    const weekAcc = new Map<number, { weights: number[]; volume: number; reps: number }>();
    const best1RMs: number[] = [];
    let setsDone = 0;
    let setsSkipped = 0;

    for (const { week, sets } of sessions) {
      const done = sets.filter(isDoneSet);
      const doneCount = setCount(done);
      const skipped = setCount(sets.filter(s => !isDoneSet(s)));
      setsDone += doneCount;
      setsSkipped += skipped;
      const reps = done.map(s => s.actualReps!);
      perSession.push({
        week,
        sets: doneCount,
        skippedSets: skipped,
        reps: reps.length > 0 ? rangeText(Math.min(...reps), Math.max(...reps)) : null,
        target: sessionTarget(sets),
      });

      const w = weekAcc.get(week) ?? { weights: [], volume: 0, reps: 0 };
      for (const s of done) {
        w.reps += s.actualReps!;
        if (hasWeight(s)) {
          w.weights.push(s.weight!);
          w.volume += s.weight! * s.actualReps!;
        }
      }
      weekAcc.set(week, w);

      const weighted = done.filter(hasWeight);
      if (weighted.length > 0) {
        best1RMs.push(Math.max(...weighted.map(s => calculate1RM(s.weight!, s.actualReps!, formula))));
      }
    }

    let e1rm: CoachExerciseSummary['e1rm'] = null;
    if (best1RMs.length > 0) {
      const start = best1RMs[0]!;
      const end = best1RMs[best1RMs.length - 1]!;
      e1rm = {
        startKg: round(start),
        endKg: round(end),
        changePct: start > 0 ? round(((end - start) / start) * 100) : null,
      };
    }

    const perWeek: CoachExerciseWeek[] = [...weekAcc.entries()]
      .sort((x, y) => x[0] - y[0])
      .map(([week, v]) => ({
        week,
        avgKg: v.weights.length > 0 ? round(v.weights.reduce((s, n) => s + n, 0) / v.weights.length) : null,
        volumeKg: Math.round(v.volume),
        totalReps: v.reps,
      }));

    exercises.push({ name: a.name, sessions: sessions.length, e1rm, setsDone: round(setsDone), setsSkipped: round(setsSkipped), perSession, perWeek });
  }
  exercises.sort((x, y) => y.sessions - x.sessions || x.name.localeCompare(y.name));

  // Muscles
  const muscles: CoachMuscleSummary[] = [...muscleSets.entries()]
    .map(([id, sets]) => ({
      muscle: muscleName(id),
      sets: round(sets),
      setsPerWeek: round(sets / weeks),
      volumeKg: Math.round(muscleVolume.get(id) ?? 0),
    }))
    .sort((x, y) => y.sets - x.sets);
  const undertrained = getAllGlobalMuscleIds()
    .map(id => ({ muscle: muscleName(id), setsPerWeek: round((muscleSets.get(id) ?? 0) / weeks) }))
    .filter(m => m.setsPerWeek < UNDERTRAINED_SETS_PER_WEEK)
    .sort((x, y) => x.setsPerWeek - y.setsPerWeek);

  // Body weight
  const cutoffKey = localDateKey(new Date(cutoff));
  const nowKey = localDateKey(now);
  const weights = (input.bodyWeights ?? [])
    .filter(b => !b.deleted && b.date >= cutoffKey && b.date <= nowKey)
    .sort((x, y) => x.date.localeCompare(y.date));
  const bodyWeight: CoachSummary['bodyWeight'] =
    weights.length > 0
      ? {
          entries: weights.length,
          startKg: round(weights[0]!.weightKg),
          endKg: round(weights[weights.length - 1]!.weightKg),
          changeKg: round(weights[weights.length - 1]!.weightKg - weights[0]!.weightKg),
        }
      : null;

  const weeksWithoutSession = perWeekCount.filter(n => n === 0).length;

  return {
    period: { weeks, sessions: workouts.length, e1rmFormula: formula },
    frequency: {
      sessionsPerWeek: round(workouts.length / weeks),
      perWeek: perWeekCount,
      weeksWithoutSession,
      byDay,
      avgDurationMin: durations.length > 0 ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length) : null,
    },
    currentSchema: schema ? schemaToJson(schema, nameById) : null,
    exercises: exercises.slice(0, MAX_EXERCISES),
    muscles,
    undertrained,
    bodyWeight,
    notes: {
      sessions: sessionNotes.slice(-MAX_NOTES),
      exercises: exerciseNotes.slice(-MAX_NOTES),
    },
    existingExercises: input.exercises
      .filter(e => !e.deleted)
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b)),
  };
}
