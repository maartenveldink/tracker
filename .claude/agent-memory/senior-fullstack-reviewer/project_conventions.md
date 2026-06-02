---
name: Recurring Patterns & Conventions
description: Code conventions, patterns, and known issues found during first full codebase review
type: project
---

**Naming:** PascalCase components/pages, camelCase hooks/functions, no kebab-case files in practice.

**Data access pattern:** useLiveQuery for reads, plain async functions for writes (no optimistic updates).

**Write pattern for nested Dexie data:** Read-modify-write on arrays (workout.exercises, exercise.sets) — NOT atomic, race condition risk under concurrent writes.

**Key known issues (from first full review, 2026-06-02 — confirmed fixed in second review):**
- useEffect form-prefill now uses initialized.current ref guard — fixed
- navigate() during render moved to useEffect with completedRef guard — fixed
- WorkoutPage exercise keys now use workoutExercise.exerciseId — fixed (but duplicate-exercise key collision remains)
- maxSets hoisted out of .map() in SchemaDetailPage via IIFE — partially fixed (still IIFE, not useMemo)
- Race conditions in useWorkout wrapped in db.transaction — fixed

**Remaining / new issues (second review, 2026-06-02):**
- WorkoutPage formatDuration() is a local duplicate of lib/utils formatDurationClock() — not yet consolidated
- WorkoutPage key={workoutExercise.exerciseId} collides when the same exercise is added twice in one workout
- WorkoutPage handleFinish() calls navigate() directly after completeWorkout() AND the useEffect redirect also fires — double navigation risk
- SchemaDetailPage key={i} still used for schema exercise cards (index key)
- ProgressPage key={i} still used for inline set spans
- StartWorkoutPage renders early-return JSX (activeWorkout guard) before hooks are declared — hooks order violation
- seedDemoData schemaId correctly wired now (variable assigned from db.schemas.add)
- formula still hardcoded to 'epley' in ExerciseDetail — OneRMFormula UI not wired (known TODO)
- No error boundaries anywhere in the app (still open)
- brzycki formula blows up at reps >= 37 (division by zero/negative denominator) — unclamped in calculate1RM
- Workout notes textarea calls updateWorkoutNotes on every keystroke — fires a DB write per character

**How to apply:** Flag these patterns when they appear in new code. The read-modify-write race condition is the most structurally risky pattern to watch for in workout writes.
