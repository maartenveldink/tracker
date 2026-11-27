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
- **Node.js:** 22 (see `.nvmrc`; `engines` is `>=22.12`, Vitest 5 requires it)

## Commands

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # TypeScript check + Vite production build
npm run preview  # Preview production build
npx tsc --noEmit # Type-check only
npm test         # Vitest unit tests (pure logic only, Node, fast)
npm run e2e      # Playwright end-to-end tests (auto-starts dev server)
```

## Testing

Two layers, deliberately small:

- **Vitest** (`npm test`, config `vitest.config.ts`, Node environment, `src/**/*.test.ts`)
  for **pure logic only** that can really go wrong: state machines, derived
  calculations (1RM, plateau, averages), celebration triggers. No jsdom, no
  component or UI tests, no tests for trivial helpers. Test files sit next to the
  lib (`sets.ts` -> `sets.test.ts`).
- **Playwright e2e** (`e2e/`, Page Object Model + fixtures, mobile Chromium) drives
  the real app + IndexedDB and covers the UI; CI runs it on every PR. See `docs/e2e-testing.md`
  (live-workout test ids: `current-exercise`, `weight-input`, `reps-input`, `set-row`, `overview-row`, `rest-timer`).

Run `npm test` and `npx tsc --noEmit` while working; `npm run build` and
`npm run e2e` (plus `npm run e2e:typecheck` for test changes) before pushing. The
machine is small: run e2e once, never two browsers at the same time.

## Project Structure

```
src/
  db/
    index.ts      # Dexie DB class (versioned migrations) + all entity types
    muscles.ts    # Standardised muscle group definitions (global + detailed)
  hooks/
    useSettings.ts # App settings (singleton row), defaults; useSettingsState() also returns `loaded` (wait for it before a one-off decision such as playing a celebration)
  styles/
    tokens.css    # Design tokens (colours, type scale, radii, sizes, motion); Tailwind maps to these in tailwind.config.js
  components/     # App-wide shared UI (Layout bottom nav + "Meer" sheet, PageHeader, ConfirmDialog, ...)
    ui/           # Design-system primitives on the tokens: button, card, chip, list-row, stat-tile, tabs, switch, sheet, dialog, input, progress, ...
  pages/          # Top-level (non-feature) pages
    DashboardPage.tsx # Home landing: streak, week stats, recent PRs, quick weigh-in, resume
    SettingsPage.tsx  # Settings (1RM formula, muscle detail, workout density, weight steps, rest timer + defaults, data tools)
  lib/            # Cross-cutting utils (dateUtils, exportData, importData, share, utils)
  features/
    training/     # Exercises, schemas, live workout, progress & metrics — the whole app
      db/         # seed (25 default exercises: muscles + laterality + movement type), demo data
      hooks/      # useExercises (+ useExerciseLookup), useSchemas, useWorkout, useProgress, useBodyWeight, useCoachSummary, useWakeLock (screen on during a workout)
      lib/        # liveTraining (live-workout state machine: current exercise, set/step actions, primary button label incl. "Opslaan"), setRegistration (B1: opened set `sel`, set dots, Gedaan rows + difference per set, set-card values, "Set verwijderen" rule, rest-ring fraction/labels; D1U unilateral: isUnilateral, sideDots, zigzagLayout, pairDelta, "na R" ring text; setProgress for the overview), celebration ("better than last time" trigger + `finishedBetterThanLastTime`), workoutSummary (summary: PRs, better than last time, volume delta vs the previous session of the schema day, headline, fireworks rule + `shouldPlayArrivalCelebration`), progressInsights (plateau, new PR, recent training stats), lastPerformed (last session per exercise), workoutBuild, estimateSchemaTime, activeSchemas (which schemas show on Train/Home), suggestWorkout, home (Home derived values: week dots, volume delta, last trained per muscle group, next training, empty state), schemaDays (pure schema/day helpers, re-exported by useSchemas), restTime (rest resolution + matrix), weightStep (equipment→weight increment), superset (grouping), metrics (streak/volume/PRs/heatmap), sets (shared set predicates: isCompletedSet/isWeightedSet/setVolume/removeSetAt/pairPartnerIndex), insertPosition (where an added exercise lands), deload (stall detection), deloadDismiss, goalProgress (exercise goal %), calendarMonth (month grid), reps, schemaShare, schemaJson (readable schema format: validation + mapping + schemaToJson), coachSummary / coachPrompt (analysis summary + prompt for Claude)
      pages/      # Exercise* (ExerciseDetailPage = `/exercises/:id`: info card + shared ExerciseDetail; edit via `/exercises/:id/edit`), Schema*, SchemaImport, StartWorkout, SuggestWorkout, Workout, WorkoutEdit, WorkoutHistory, WorkoutSummary, Progress
      components/ # ExerciseDetail (goal + 1RM chart + sessions, shared by Progress and the exercise detail page); ExerciseForm; Live* (B1 set registration): LiveSetProgress (set dots), LiveSideProgress (D1U zigzag for unilateral exercises), LiveSetCard (two-column steppers), LiveDoneList (Gedaan list with difference), LiveRestRing (rest ring next to the main button), LiveOverviewSheet, LiveAddExerciseSheet; ExerciseMoment, CelebrationEffects (fireworks/confetti, live workout + summary), WeeklySetsCard, PeriodChips, chartTheme (chart colours from tokens), MuscleChip, BodyWeightSection, RecordsBoard, ConsistencyHeatmap, TrainingCalendar, VolumeTrendChart, WorkoutHistory, MuscleVolumeBars, GoalProgressBar, DeloadCard, CoachCopySection
    habits/       # Habit tracker (/habits): pages/ (list, detail, form), components/ (HabitControl, HabitHeatmap, HabitsTodayCard), hooks/useHabits, lib/schedule (pure schedule + streak logic)
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
- **Local-only prefs** (deload snooze) live in `localStorage` (`tracker.deload.*`), never in `AppSettings`, export or sync; `clearAllData()` removes them.

## Implemented Epics

- **Epic 1** (E1-01 to E1-08): Exercise & muscle database — CRUD, search, filter, seed data; per-exercise laterality (bilateral/unilateral) and movement type (compound/isolation) toggles; per-exercise default rest; per-exercise equipment (cable/dumbbell/plates/other) that drives the weight increment, auto-detected from name/description; optional per-exercise **goal** (`Exercise.goal` = weight × reps) with a progress bar (`lib/goalProgress.ts`, `GoalProgressBar`) on the exercise history and the Records board. Limitation: edits to default exercises (incl. a goal) are not exported/synced.
- **Epic 2** (E2-01 to E2-12): Training schemas — CRUD, exercise ordering, copy, muscle coverage analysis, suggestions, multi-day schemas; collapsible exercise cards; rest-per-set; QR/link sharing; **active schema** (`TrainingSchema.active`, optional boolean, not indexed; toggle on list + detail; Train and Home show only active schemas, all when none is active; `lib/activeSchemas.ts`; copies and shared/JSON-imported schemas start inactive (full backup import keeps the flag); synced inside the schema document, no server change); import from readable JSON (paste or file, `/schemas/import`, schema in `docs/schema-format.json`, keep in sync with `SchemaJson`).
- **Epic 3** (E3-01 to E3-09 core; E3-10..): Live workout logging — start from schema or free ("Vrije training", ad-hoc), set logging, pause/resume, summary; rest ring (tap = +30 sec, idle ring starts the rest by hand) with vibration/sound/notification alerts; quick logging; weight prefill & carry-over from previous session; previous-session references; live muscle-group volume overview (shared `MuscleVolumeBars` with the summary) to decide what to still train; an exercise added mid-workout is inserted after the last finished exercise (never inside a superset, see `lib/insertPosition.ts`).
- **Epic 4**: Training history per exercise with 1RM chart + session list; workout edit and delete. Progress page sections: **Records board**, **Consistency heatmap**, **Volume / muscle-balance trend**, **Body-weight tracking**, a **Workout history overview** with delete, and a **month calendar** under the heatmap (`TrainingCalendar`; Progress reads `?tab=overview`).
- **Dashboard** (redesigned, WP2): Home landing "Vandaag" with hero "Aan de beurt" (next schema day via rotation, else suggestion; empty state "Begin je eerste training"), week card with day dots, stat tiles (streak, volume + delta, weight with "+ Log" sheet), "Laatst getraind" per muscle group, recent PRs, habits — powered by `metrics` + `home` libs. Also shows a **deload suggestion** (`DeloadCard`, rule + thresholds in `lib/deload.ts`; snoozable for a week).
- **Viering "Oefening klaar"** (WP5): trigger = gemiddeld geschat 1RM over gewogen sets > vorige sessie (`lib/celebration.ts`, pure + tests; `lib/workoutSummary.ts` gebruikt dezelfde vergelijking voor de samenvatting). Banner + vergelijkingstabel (`ExerciseMoment`) zijn afgeleid van de sets; confetti/vuurwerk (`CelebrationEffects`) en trillen vuren op het moment dat een set wordt gelogd waarmee een oefening (ook een superset-lid dat niet in beeld is) klaar is en de trigger waar is (`finishedBetterThanLastTime` in `lib/celebration.ts`); geen replay na terugkeren naar een afgeronde oefening of na reload, en geen viering zonder vorige sessie. Instellingen `celebrationEnabled`/`celebrationVibrate`; reduced motion = geen effecten.
- **Samenvatting** (`WorkoutSummaryPage`, `lib/workoutSummary.ts`, pure + tests): hero met kop ("Je bent vooruitgegaan" alleen bij een PR of een oefening beter dan vorige keer, anders eerlijk "Training voltooid"), duur/sets/volume, volume-delta t.o.v. de vorige sessie van dezelfde schema(dag), streak, hoogtepunten, oefeningkaarten met vergelijking, spiergroep-volume. Alles vergeleken met *eerdere* trainingen. Na het afronden speelt dezelfde `CelebrationEffects` (+ trillen) eenmalig, alleen als er iets te vieren is: router-flag `justFinished` (alleen gezet als de live training de workout nog lopend zag, daarna direct gewist) + `completedAt` hooguit 5 min oud (`shouldPlayArrivalCelebration`), pas als `useSettingsState().loaded`.
- **Supersets**: consecutive exercises sharing a `supersetGroup` are trained alternating; linked in the schema editor, rest resolves after the round. See `features/training/lib/superset.ts`.
- **Progressive overload**: hitting the top of the rep range on every set bumps the next session's suggested weight by one increment (per-exercise `weightStep` override, else the equipment/global step).
- **Epic 8**: Settings — 1RM formula, muscle detail level, workout density, per-equipment weight steps, rest timer + alert toggles + laterality×movement-type rest-defaults matrix; clear data, JSON export/import.

- **Habits** (`docs/plan.habit-tracker.md`, `docs/requirements.habit-tracker.md`): daily habits (on/off or counter) with flexible schedules (daily, every x days, weekdays, month days), streaks, heatmap, own tab (`/habits`) and a "today" card on the Dashboard. Tables `habits`/`habitLogs` (DB v16).
- **AI-coach** (`docs/plan.ai-coach.md`): step 1 readable schema JSON + import screen; step 2 "Kopieer voor AI" on the schema detail (`coachSummary` + `coachPrompt`, no raw sets, relative weeks) — copy/paste into an AI chat, answer pasted back via the import screen. Step 3 (direct Anthropic API call with a local API key) was built and then removed again; it is in git history (PR #3, `cb9f719`). Step 4 (reminder card) is not built.
- **Import/export**: JSON import revives `Date` fields and, in merge mode, remaps `schemaId`/`exerciseId`.

## Redesign (design handoff)

Status: WP0-WP8 are done, plus Training B1 (PR #43) and D1U (unilateral) (see `docs/plan.redesign.md`; a11y/PWA review and open points in `docs/redesign-wp8-review.md`).

A visual makeover is planned in `docs/plan.redesign.md` (work packages WP0-WP8). Source of
truth for looks: `docs/design-handoff/` (`DESIGN.md`, `tokens/`, `screens/*.dc.html`, which
are readable specs and do not run). Rule: the repo wins for behaviour and data, the design
wins for looks. Conventions for redesigned screens:

- Use design tokens (Tailwind classes mapped to `tokens.css`), no loose hex values and no `slate-*` classes.
- Keep existing e2e labels/aria names, or update the Page Objects in the same PR.
- Never drop an existing feature (calendar, heatmap, goals, deload) without the owner deciding.
- No data model, sync or API changes unless a work package says so.
- Respect `prefers-reduced-motion`; fonts are self-hosted (`@fontsource-*`) for offline use.
- Colours: `danger` (light, for error text/icons, 8:1) vs `destructive` (solid fill of destructive buttons). There is no warning/success token: positive = `accent`, data/delta = `accent-2`.
- Accessibility (DESIGN §11): tap targets >= 44px (`h-touch`/`w-touch`), icon buttons need an `aria-label`, informational colour always comes with text, the rest end is announced once via an `aria-live` region, content max 560px (`max-w-column`) also for the bottom nav on wide screens, reduced motion via tokens + `index.css`.
- Pure logic from the design (training state machine, "better than last time" trigger = average estimated 1RM over weighted sets, derived stats) goes in `features/training/lib/` with Vitest tests.

## Training B1 (set registration)

The live screen follows `docs/design-handoff/screens/TrainingB1.dc.html`: bar with workout timer + list + pause + Afronden;
name, "Vorige keer", goal chip (and the superset chip); set dots (`set-row`, one per set,
`aria-pressed` = opened; unilateral exercises get the D1U zigzag instead, see below); set card for the opened set; Gedaan list (`done-row`) with the difference to the same set last
time (reps at the same weight, kg at another weight, "nieuw"; no 1RM, `--color-worse` for worse, always with arrow +
text); fixed bottom row with the rest ring (`rest-timer` while running, `rest-ring-idle` otherwise) + main button
("Set klaar" / "Opslaan" for an opened logged set / "Volgende oefening" / "Laatste oefening afronden"). Decisions (owner
not reachable, DESIGN §12 defaults): "Set verwijderen" is a muted text button under the card, only on the opened last,
not yet logged set; an opened logged set also offers "Set terugzetten" (undo completion). Skip/add exercises only via
the overview sheet. Notes, per-exercise rest and "Oefening verwijderen" stay as text buttons under the Gedaan list.
Supersets keep the existing logic (`afterSetLogged`); there is no superset design yet (B2 rejected).
The previous live components `LiveStepper` and `LiveRestStrip` were replaced by B1 and removed; the "Zelfde als vorige"
button was removed before (PR #38; E3-19/SL-02 are void).

## Training D1U (unilateral set registration)

For an exercise whose sets are logged per side (`WorkoutSet.side`, from `Exercise.laterality === 'unilateral'` when
the workout is built) the live screen follows `docs/design-handoff/screens/TrainingD1U.dc.html`: B1, but the set dots
are a zigzag (`LiveSideProgress`, `side-dot` with `data-set`/`data-side`): one 28 px dot per side, left on the top row,
right on the bottom row, order L1 → R1 → L2 → R2, a line from centre to centre (accent when the part it leaves is
done), the plus dot on the top row at the end, 44 × 44 tap targets centred on the dots; `step = min(46, (width − 24) /
(parts + 1))` from the measured width, so 8 sets fit without scrolling (the tap targets then overlap, DESIGN §12 q13).
No visible side label (an `sr-only` line names the opened side). Data model unchanged: the design's set
`{weight, left, right}` is the stored left row + right row of the same logical set (weight stays per row).
Rules (pure, `lib/setRegistration.ts` + `afterSetLogged`): after the left part the right part starts with its values
(`openSetValues`, partner first); rest starts only once a part completes its set (after the right part, or the left
one if right was logged first) and never after the last set; every "Set klaar" ends a running rest (`restTimerAfterSetLogged`: restart with a new rest, else cleared, so also after a left part);
the idle ring shows "na R" (0:00 right after a rest ran out); the Gedaan list has one row per set with both sides
logged, `Set 1 · 20 kg · L 12 · R 12` (per-side weight when the sides differ), difference = sum of the reps
difference left + right at the same weight, else kg (DESIGN §12 q10), `nieuw` without a full previous set; the
overview counts a unilateral set once (`setProgress`). Bilateral exercises are exactly B1. Unilateral is set per
exercise (`Exercise.laterality`, Epic 1 toggle), so there is no extra switch (DESIGN §12 q9).
Known limitation: a unilateral exercise inside a superset keeps the superset logic (members alternate per row, so
per side, and rest can start between L and R); supersets are not designed yet.

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
