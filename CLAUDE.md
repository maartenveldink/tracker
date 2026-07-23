# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tracker is a personal fitness PWA for planning and logging strength training sessions. Data is stored locally in IndexedDB (offline-first, no backend). Single-user, no auth.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite 6
- **Styling:** Tailwind CSS 3
- **Database:** IndexedDB via Dexie.js 4
- **PWA:** vite-plugin-pwa (service worker, installable)
- **Routing:** React Router v7
- **Node.js:** 22 (see `.nvmrc`)

## Commands

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # TypeScript check + Vite production build
npm run preview  # Preview production build
npx tsc --noEmit # Type-check only
npm run e2e      # Playwright end-to-end tests (auto-starts dev server)
```

## Testing

End-to-end tests use Playwright (`e2e/`, Page Object Model + fixtures, mobile
Chromium). See `docs/e2e-testing.md` for the architecture and conventions. There
are no unit tests; the suite drives the real app + IndexedDB. Run `npm run e2e`
(and `npm run e2e:typecheck`) before pushing test changes.

## Project Structure

```
src/
  db/
    index.ts      # Dexie DB class (versioned migrations) + all entity types
    muscles.ts    # Standardised muscle group definitions (global + detailed)
  hooks/
    useSettings.ts # App settings (singleton row), defaults, feature flags
  components/     # App-wide shared UI (Layout bottom nav, PageHeader, ConfirmDialog, ...)
  pages/          # Top-level (non-feature) pages
    DashboardPage.tsx # Home landing: streak, week stats, recent PRs, quick weigh-in, resume
    SettingsPage.tsx  # Settings (1RM formula, muscle detail, macro goals, rest timer + defaults, flags, data tools)
  lib/            # Cross-cutting utils (dateUtils, exportData, importData, share, utils)
  features/
    training/     # Exercises, schemas, live workout, progress & metrics
      db/         # seed (25 default exercises: muscles + laterality + movement type), demo data
      hooks/      # useExercises, useSchemas, useWorkout, useProgress, useBodyWeight
      lib/        # restTime (rest resolution + matrix), weightStep (equipment→weight increment), metrics (streak/volume/PRs/heatmap), reps, schemaShare
      pages/      # Exercise*, Schema*, StartWorkout, Workout, WorkoutEdit, WorkoutSummary, Progress
      components/ # MuscleChip, BodyWeightSection, RecordsBoard, ConsistencyHeatmap, VolumeTrendChart, WorkoutHistory, MuscleVolumeBars
    nutrition/    # Foods, recipes, daily macro log (optional module)
    planner/      # Weekly planner (optional module)
    google-health/# Google Health OAuth + sleep/steps/HR sync (optional module)
  App.tsx         # Routes (Dashboard is "/"), lazy-loads heavy/optional pages
  main.tsx        # Entry point (seeds DB, inits settings, renders app)
  index.css       # Tailwind directives
```

## Conventions

- **Language:** TypeScript strict mode, no `any`
- **Styling:** Tailwind utility classes, dark theme (slate palette), mobile-first
- **Data access:** Dexie `useLiveQuery` for reactive reads; plain async functions for writes
- **Components:** Function components, no class components
- **Naming:** PascalCase for components, camelCase for hooks/functions, kebab-case for files would be fine but currently PascalCase for pages/components
- **No external state management:** Dexie live queries replace Redux/Zustand

## Implemented Epics

- **Epic 1** (E1-01 to E1-08): Exercise & muscle database — CRUD, search, filter, seed data; per-exercise laterality (bilateral/unilateral) and movement type (compound/isolation) toggles; per-exercise default rest; per-exercise equipment (cable/dumbbell/plates/other) that drives the weight increment, auto-detected from name/description.
- **Epic 2** (E2-01 to E2-12): Training schemas — CRUD, exercise ordering, copy, muscle coverage analysis, suggestions, multi-day schemas; collapsible exercise cards; rest-per-set; QR/link sharing.
- **Epic 3** (E3-01 to E3-09 core; E3-10..): Live workout logging — start from schema or free ("Vrije training", ad-hoc), set logging, pause/resume, summary; rest timer with skip/reset and vibration/sound/notification alerts; quick logging; weight prefill & carry-over from previous session; previous-session references; live muscle-group volume overview (shared `MuscleVolumeBars` with the summary) to decide what to still train.
- **Epic 4**: Training history per exercise with 1RM chart + session list; workout edit and delete. Progress page sections: **Records board**, **Consistency heatmap**, **Volume / muscle-balance trend**, **Body-weight tracking**, and a **Workout history overview** with delete.
- **Dashboard**: Home landing aggregating streak, this-week sessions/volume, recent PRs, quick weigh-in, and resume-active-workout — powered by a shared `metrics` lib.
- **Epic 5** (E5-01, E5-04 to E5-09): Food database CRUD + recipes with auto-calculated macros; Open Food Facts text search (E5-09). Optional module (feature flag).
- **Epic 6** (E6-01 to E6-05): Daily nutrition log with macro totals and progress vs. goals. Optional module.
- **Epic 7**: Google Health integration (OAuth + PKCE, sleep/steps/HR sync). Optional module.
- **Epic 8** (E8-01 to E8-09): Settings — 1RM formula, muscle detail level, macro goals, rest timer + alert toggles + laterality×movement-type rest-defaults matrix, feature flags; clear data, load demo, JSON export/import.
- **Epic 9**: Weekly planner (assign schema days to weekdays). Optional module.

## Rest-time resolution

Effective rest between sets resolves specific→general (see `features/training/lib/restTime.ts`):
`SchemaExercise.restSeconds` → `Exercise.restTimerSeconds` → laterality×movement-type matrix (`AppSettings.restDefaults`, only when both known) → global `AppSettings.restTimerSeconds`. See `docs/refinement.rest-time.md`.

## Not Yet Implemented

- Nutrition (partial): Barcode scanner (E5-02, E5-03), favourites (E6-06)
- Planner (partial): meal-prep suggestions (Epic 9)
