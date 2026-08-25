# End-to-end testing architecture

Tracker's end-to-end (e2e) suite drives the **real app in a real browser** and
asserts on what a user would see. It exists because the app is offline-first
with no backend: the interesting behaviour lives in the interplay between
React, Dexie/IndexedDB and the router — exactly the seams that unit tests miss.

- **Runner:** [Playwright Test](https://playwright.dev) (`@playwright/test`)
- **Config:** [`playwright.config.ts`](../playwright.config.ts)
- **Tests:** [`e2e/`](../e2e)

## Quick start

```bash
nvm use                       # Node 22 (see .nvmrc)
npx playwright install chromium   # one-time: download the browser
npm run e2e                   # run the suite (auto-starts the dev server)
npm run e2e:ui                # interactive UI mode (watch, time-travel)
npm run e2e:report            # open the last HTML report
npm run e2e:typecheck         # type-check the e2e sources
```

You don't need to start `npm run dev` yourself — Playwright's `webServer` boots
it and reuses an already-running one locally.

## Folder structure

```
e2e/
  fixtures/
    app.ts            # custom test fixtures — inject page objects
  pages/              # Page Objects (one per screen)
    ExercisesPage.ts  ExerciseFormPage.ts
    SchemasPage.ts    SchemaEditorPage.ts   SchemaDetailPage.ts
    StartWorkoutPage.ts  WorkoutPage.ts
    DashboardPage.ts  ProgressPage.ts       SettingsPage.ts
  tests/              # specs (*.spec.ts)
    smoke.spec.ts        superset.spec.ts   superset-advanced.spec.ts
    exercises.spec.ts    exercise-advanced.spec.ts
    schemas.spec.ts      schemas-advanced.spec.ts
    workout.spec.ts      workout-advanced.spec.ts
    settings.spec.ts     dashboard.spec.ts  progress.spec.ts
    progressive-overload.spec.ts
  tsconfig.json       # type-checking config for the e2e sources
```

## Coverage

The suite exercises the main user flows across the app:

- **Exercises** — create, search, edit, delete.
- **Schemas** — create, copy, delete, a share → re-import round-trip (which also
  proves supersets survive sharing), multi-day schemas (build + start a chosen
  day), and the muscle-coverage breakdown.
- **Supersets** — link/unlink in the editor; alternating registration and
  rest-after-round in the live workout.
- **Live workout** — free and schema-based workouts to summary, pause/resume,
  weight carry-over, rest timer.
- **Progressive overload** — hitting the target reps bumps the next suggestion.
- **Suggested workout** — the cold-start full-body suggestion, target-duration
  control, adding an exercise, and the swap-for-similar sheet.
- **Progression** — the summary's "Vooruitgang" flag vs an all-time PR, and the
  Progress "Progressie" tab listing an exercise's % 1RM change.
- **Progress & history** — records board, workout history + delete, body-weight
  logging.
- **Dashboard** — quick weigh-in, resume active workout.
- **Settings** — 1RM formula, weight-step and muscle-detail persistence,
  clear-all, and a data export → wipe → import round-trip.

A test reads as intent, not mechanics:

```ts
await schemaEditor.addExercise('Barbell Bench Press');
await schemaEditor.addExercise('Barbell Row');
await schemaEditor.linkWithPrevious('Barbell Row');
await expect(schemaEditor.supersetGroups).toHaveCount(1);
```

## Design choices

### 1. Test against the real app, not mocks
The app has no server to stub. Its logic is in the UI + IndexedDB. So the suite
runs the actual Vite dev build and interacts through the DOM. The
`webServer` block in the config owns the server lifecycle; `reuseExistingServer`
keeps the local loop fast.

### 2. Isolation via a fresh browser context
Every Playwright test gets its own browser context, which means its own empty
IndexedDB. On first navigation the app seeds its 25 default exercises, so each
test starts from a clean, known state **without any manual database teardown**.
This is why specs never clean up after themselves and never collide.

### 3. Page Object Model + fixtures
Selectors and interactions live in [`e2e/pages`](../e2e/pages); specs describe
scenarios. This keeps specs readable and centralises the churn when the UI
changes. Page objects are handed to specs through Playwright
[fixtures](../e2e/fixtures/app.ts) (`schemaEditor`, `startWorkout`, `workout`),
so there is no manual construction and no shared mutable state between tests.

### 4. Selector strategy: user-facing first, semantic `data-testid` where needed
In priority order:
1. **Role/label/text** — `getByRole`, `getByLabel`, `getByText`, and the
   `aria-label`s the app already sets on icon-only buttons (e.g.
   `"Superset met vorige"`). These double as accessibility checks.
2. **`data-testid`** — only for a handful of *structural* hooks that have no
   good user-facing selector, listed below.

We deliberately **never** assert on Tailwind classes (e.g. `bg-blue-950/30`):
that couples tests to styling and breaks on cosmetic changes. The few test IDs
are semantic and style-independent.

| `data-testid`     | Element                              | Used for |
|-------------------|--------------------------------------|----------|
| `superset-group`  | superset wrapper (editor & workout)  | asserting a group exists / is dissolved |
| `schema-exercise` | an exercise row in the schema editor | scoping actions to one row |
| `exercise-card`   | an exercise card in the live workout | following the app's focus |
| `quick-reps`      | the quick-rep bar of the active set  | detecting the expanded card, logging reps |
| `set-weight`      | the weight input of a set            | entering weight |
| `rest-timer`      | the rest countdown bar               | asserting rest starts (only) after a round |

> "The expanded card" is derived, not tagged: only the expanded exercise renders
> its set grid, so the expanded card is *the `exercise-card` that contains a
> `quick-reps` bar*. This tracks the app's focus without extra state.

### 5. Mobile-first viewport
The app is mobile-first, so the single project uses `devices['Pixel 5']`
(mobile Chromium with touch). One browser keeps CI fast and matches the primary
target; more browsers/devices can be added as extra `projects` later.

### 6. Fail-only artifacts
Traces (`on-first-retry`), screenshots and video are captured **only on
failure**, keeping green runs cheap while giving a full replay when something
breaks. Retries are enabled in CI (`2`) to absorb rare flakiness; `0` locally so
failures surface immediately.

### 7. CI
[`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) runs on pushes to
`main` and on PRs: Node 22, `npm ci`, `npx playwright install --with-deps
chromium`, then `npm run e2e`. The HTML report is uploaded as an artifact.

## App-specific gotchas (handled in the page objects)

State that round-trips through IndexedDB is asynchronous, so a few flows need an
explicit wait — encapsulated in the page objects, not repeated in specs:

- **Recent-use warning (CT-06)** — starting a schema used within 48h shows a
  "Toch starten" confirmation first; `StartWorkoutPage.start` clicks it if
  present, so re-running the same schema (e.g. the progressive-overload test)
  works.
- **Set completion** — a logged weight round-trips before it counts, so
  `completeActiveSet` waits briefly between entering the weight and tapping reps.

## Adding a test

1. Reuse or extend a page object in `e2e/pages` — put selectors and actions
   there, not in the spec.
2. If you need a new structural hook, add a semantic `data-testid` in the app
   and document it in the table above. Prefer a role/label selector first.
3. Write the spec in `e2e/tests/*.spec.ts` using the `test`/`expect` from
   [`e2e/fixtures/app.ts`](../e2e/fixtures/app.ts) (not straight from
   `@playwright/test`) so the page-object fixtures are available.
4. Keep tests independent — rely on the fresh-context isolation, don't depend on
   another test's data.
5. Run `npm run e2e:typecheck` and `npm run e2e` before pushing.
