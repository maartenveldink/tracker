# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tracker is a personal fitness PWA for planning and logging strength training sessions. Data is stored locally in IndexedDB (offline-first). When built with `VITE_PB_URL` the app also requires a login and syncs to a self-hosted PocketBase (`server/`, `src/lib/sync/`, `src/features/auth/`); without it the app runs purely local. Practically single-user.

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
    useSettings.ts # App settings (singleton row), defaults
  components/     # App-wide shared UI (Layout bottom nav, PageHeader, ConfirmDialog, ...)
  pages/          # Top-level (non-feature) pages
    DashboardPage.tsx # Home landing: streak, week stats, recent PRs, quick weigh-in, resume
    SettingsPage.tsx  # Settings (1RM formula, muscle detail, workout density, weight steps, rest timer + defaults, data tools)
  lib/            # Cross-cutting utils (dateUtils, exportData, importData, share, utils)
  features/
    training/     # Exercises, schemas, live workout, progress & metrics — the whole app
      db/         # seed (25 default exercises: muscles + laterality + movement type), demo data
      hooks/      # useExercises (+ useExerciseLookup), useSchemas, useWorkout, useProgress, useBodyWeight, useCoachSummary
      lib/        # restTime (rest resolution + matrix), weightStep (equipment→weight increment), superset (grouping), metrics (streak/volume/PRs/heatmap), sets (shared set predicates: isCompletedSet/isWeightedSet/setVolume/removeSetAt), insertPosition (where an added exercise lands), deload (stall detection), deloadDismiss, goalProgress (exercise goal %), calendarMonth (month grid), reps, schemaShare, schemaJson (readable schema format: validation + mapping + schemaToJson), coachSummary / coachPrompt (analysis summary + prompt for Claude), claudeCoach (Anthropic API client), coachConfig (API key + model, localStorage), coachDiff (proposal vs current schema)
      pages/      # Exercise*, Schema*, SchemaImport, Coach (lazy), StartWorkout, Workout, WorkoutEdit, WorkoutSummary, Progress
      components/ # MuscleChip, BodyWeightSection, RecordsBoard, ConsistencyHeatmap, TrainingCalendar, VolumeTrendChart, WorkoutHistory, MuscleVolumeBars, GoalProgressBar, DeloadCard, CoachCopySection, CoachSettingsCard
  App.tsx         # Routes (Dashboard is "/"), lazy-loads the Progress page
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
- **Exercise names in history/schemas:** look names and metadata up via `useExerciseLookup` (includes soft-deleted exercises). Pickers and suggestions keep using `useExercises` (excludes deleted).
- **Sets without weight:** a completed set with reps > 0 counts as a set even without weight (bodyweight work), but contributes 0 kg volume and no 1RM/PR. Use the predicates in `features/training/lib/sets.ts`.
- **Secrets and local-only prefs** (Claude API key/model, deload snooze) live in `localStorage` (`tracker.coach.*`, `tracker.deload.*`), never in `AppSettings`, export or sync; `clearAllData()` removes them.

## Implemented Epics

- **Epic 1** (E1-01 to E1-08): Exercise & muscle database — CRUD, search, filter, seed data; per-exercise laterality (bilateral/unilateral) and movement type (compound/isolation) toggles; per-exercise default rest; per-exercise equipment (cable/dumbbell/plates/other) that drives the weight increment, auto-detected from name/description; optional per-exercise **goal** (`Exercise.goal` = weight × reps) with a progress bar (`lib/goalProgress.ts`, `GoalProgressBar`) on the exercise history and the Records board. Limitation: edits to default exercises (incl. a goal) are not exported/synced.
- **Epic 2** (E2-01 to E2-12): Training schemas — CRUD, exercise ordering, copy, muscle coverage analysis, suggestions, multi-day schemas; collapsible exercise cards; rest-per-set; QR/link sharing; import from readable JSON (paste or file, `/schemas/import`, schema in `docs/schema-format.json`, keep in sync with `SchemaJson`).
- **Epic 3** (E3-01 to E3-09 core; E3-10..): Live workout logging — start from schema or free ("Vrije training", ad-hoc), set logging, pause/resume, summary; rest timer with skip/reset and vibration/sound/notification alerts; quick logging; weight prefill & carry-over from previous session; previous-session references; live muscle-group volume overview (shared `MuscleVolumeBars` with the summary) to decide what to still train; an exercise added mid-workout is inserted after the last finished exercise (never inside a superset, see `lib/insertPosition.ts`).
- **Epic 4**: Training history per exercise with 1RM chart + session list; workout edit and delete. Progress page sections: **Records board**, **Consistency heatmap**, **Volume / muscle-balance trend**, **Body-weight tracking**, a **Workout history overview** with delete, and a **month calendar** under the heatmap (`TrainingCalendar`; Progress reads `?tab=overview`).
- **Dashboard**: Home landing aggregating streak, this-week sessions/volume, recent PRs, quick weigh-in, and resume-active-workout — powered by a shared `metrics` lib. Also shows a **deload suggestion** (`DeloadCard`, rule + thresholds in `lib/deload.ts`; snoozable for a week).
- **Supersets**: consecutive exercises sharing a `supersetGroup` are trained alternating; linked in the schema editor, rest resolves after the round. See `features/training/lib/superset.ts`.
- **Progressive overload**: hitting the top of the rep range on every set bumps the next session's suggested weight by one increment (per-exercise `weightStep` override, else the equipment/global step).
- **Epic 8**: Settings — 1RM formula, muscle detail level, workout density, per-equipment weight steps, rest timer + alert toggles + laterality×movement-type rest-defaults matrix; clear data, JSON export/import.

- **Claude-coach** (`docs/plan.claude-coach.md`): step 1 readable schema JSON + import screen; step 2 "Kopieer voor Claude" on the schema detail (`coachSummary` + `coachPrompt`, no raw sets, relative weeks); step 3 direct Anthropic API call from the browser (`claudeCoach`, `CoachPage`, settings card). The proposal is saved as a **new** schema (never overwrites), new exercises are marked in the diff. The API key and model are in `localStorage` only. `tool_choice` is `auto` (a forced tool choice returns 400 on the 5.5 models). Not yet verified against the live API; e2e mocks it (`mockAnthropic`). Step 4 (reminder card) is not built.
- **Import/export**: JSON import revives `Date` fields and, in merge mode, remaps `schemaId`/`exerciseId`.

## Rest-time resolution

Effective rest between sets resolves specific→general (see `features/training/lib/restTime.ts`):
`SchemaExercise.restSeconds` → `Exercise.restTimerSeconds` → laterality×movement-type matrix (`AppSettings.restDefaults`, only when both known) → global `AppSettings.restTimerSeconds`. See `docs/refinement.rest-time.md`.

## Deploy (productie)

Live op https://tracker.app.maartenveldink.nl/ via `prod-cli` (skill `prodctl-deploy`). Eén
container (root-`Dockerfile`): PocketBase serveert de API én de gebouwde PWA op één origin
(`VITE_PB_URL=same-origin`). De PWA wordt in de Docker-build gemaakt; `dist/` hoeft niet gecommit.
Alleen gecommitte bestanden gaan mee.

```bash
prod-cli deploy --name tracker --domain app.maartenveldink.nl
```

Altijd dezelfde naam (een andere naam is een nieuwe app). Env/secrets zet een mens op de
beheerpagina: `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD` (optioneel `TRACKER_ALLOW_SIGNUP=true`).
**`/data` is het enige persistente pad op de server en bevat de database; het wordt alleen gekoppeld als de repo `data/.gitkeep` bevat (niet verwijderen)**, anders wist elke deploy de database; zie
`server/README.md`. Er is geen automatische back-up (JSON-export in de app + lokale kopieën).
Plan en requirements: `docs/plan.server-persistence.md`, `docs/requirements.server-persistence.md`.

## Removed modules

The nutrition, weekly planner and Google Health integrations were removed. Their
Dexie stores are dropped in DB version 15; older `.version(n).stores(...)` blocks
keep the historical schema names so migrations still run.
