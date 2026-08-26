# Implementatieplan — Habit tracker

Zie [`requirements.habit-tracker.md`](./requirements.habit-tracker.md) voor de
requirements. Dit plan is gefaseerd; elke fase is los te bouwen en te testen.

## Context

Dagelijkse gewoontes bijhouden naast trainingen: aan/uit- én teller-habits, met
flexibele schema's (dagelijks, elke-x-dagen, dag-van-week, dag-van-maand), streaks,
heatmap, een eigen Habits-tab en een afvinkbare "Vandaag"-kaart op het dashboard.
Offline-first, geen backend. Bouwt voort op het per-dag log-patroon van
`BodyWeightEntry` en de consistentie-metrics.

---

## Fase 1 — Data layer & logica

### 1a. Types & DB (`src/db/index.ts`)
- Voeg `HabitSchedule`, `Habit`, `HabitLog` toe (zie requirements → Datamodel).
- Voeg de twee `EntityTable`-velden toe aan de `TrackerDB`-class.
- Nieuwe migratie:
  ```ts
  this.version(16).stores({
    habits: '++id, order, archived',
    habitLogs: '++id, habitId, date, [habitId+date]',
  });
  ```
  Geen data-upgrade nodig (alleen nieuwe stores).

### 1b. Schema- & streak-lib (`src/features/habits/lib/schedule.ts`)
Pure functies, unit-vrij (gedreven door e2e):
- `isScheduledOn(schedule, date): boolean` — per `kind`:
  - `daily` → true; `interval` → `date ≥ anchor && daysBetween(anchor,date) % everyDays === 0`;
  - `weekdays` → `isoWeekday(date) ∈ days`; `monthdays` → `date.getDate() ∈ days` (niet-bestaande maanddagen vallen vanzelf weg).
- `isHabitDone(habit, value): boolean` — `boolean`: `value ≥ 1`; `count`: `value ≥ target`.
- `habitStreak(habit, doneByDate: Map<string, boolean>, today): number` — loop dag-voor-dag
  terug vanaf `today`; sla ongeplande dagen over; tel opeenvolgende voltooide geplande
  dagen; stop bij de eerste geplande-maar-niet-voltooide dag. **Uitzondering:** als
  `today` gepland maar nog niet voltooid is, breekt dat de streak niet (begin te tellen
  bij de vorige geplande dag).
- `completionRate(habit, doneByDate, from, to): number` — voltooide ÷ geplande dagen in
  de periode. Hergebruik `localDateKey` uit `features/training/lib/metrics.ts` voor keys.

### 1c. Hooks & writes (`src/features/habits/hooks/useHabits.ts`)
- `useHabits(includeArchived=false)` — `useLiveQuery` op `habits`, gesorteerd op `order`.
- `useHabitLogs(range?)` — `useLiveQuery` op `habitLogs` (optioneel gefilterd op datum).
- Writes (plain async): `createHabit`, `updateHabit`, `archiveHabit`, `reorderHabits`,
  `setHabitLog(habitId, date, value)` — upsert op `[habitId+date]` (één rij per dag;
  waarde 0 → rij verwijderen of op 0 zetten), `toggleBoolean(habitId, date)`,
  `stepCount(habitId, date, delta, target)`.

### 1d. Databeheer
- `src/lib/exportData.ts` — voeg `habits` en `habitLogs` toe aan `TrackerExport` en aan
  de parallelle `db.*.toArray()`-gather + de counts.
- `src/lib/importData.ts` — neem `habits`/`habitLogs` mee (optioneel, met `?? []` voor
  back-compat met oudere exports); bulk-add binnen de bestaande transactie.
- `src/features/training/db/seedDemoWorkouts.ts#clearAllData` — voeg
  `db.habits.clear()` en `db.habitLogs.clear()` toe.

---

## Fase 2 — Habits-pagina, formulier, detail, navigatie

### 2a. Bottom-nav herindeling ("Meer"-menu)
Los bouwbaar en al nuttig vóór de rest van Habits.
- `src/components/Layout.tsx` — vaste balk terugbrengen tot dagelijkse bestemmingen:
  **Home · Train · Progressie · Habits · Meer** (lucide voor Habits bv. `ListChecks`,
  voor Meer `MoreHorizontal`). "Meer" is geen route maar opent een **sheet** met links
  naar **Oefeningen**, **Schema's** en **Instellingen** (hergebruik `Sheet` +
  `NavLink`/`useNavigate`). Actieve-staat van "Meer" markeren wanneer de huidige route
  een van die drie is.
- De routes voor `/exercises`, `/schemas`, `/settings` blijven ongewijzigd; alleen hun
  ingang verhuist van de balk naar het Meer-menu.

### 2b. Habits — routing
- `src/App.tsx` — routes: `/habits`, `/habits/new`, `/habits/:id`, `/habits/:id/edit`
  onder de `Layout`-route (met bottom-nav).

### 2c. Habits — dagweergave (`src/features/habits/pages/HabitsPage.tsx`)
- Datumkiezer (vorige/volgende dag; niet in de toekomst).
- Toon habits waarvoor `isScheduledOn(schedule, gekozenDag)` true is.
- Per rij: boolean = afvink-toggle; count = `−  value/target  +` (hergebruik het
  StepperRow-patroon uit `SchemaFormPage`/`SuggestWorkoutPage`), plus een mini-streak.
- Lege staat als er nog geen habits zijn → link naar "Nieuwe habit".

### 2d. Formulier (`src/features/habits/pages/HabitFormPage.tsx`)
- Velden: naam, emoji, kleur, type (boolean/count → toont `target`), schema-kiezer.
- Schema-kiezer: segmented control voor `kind`, met parametervelden:
  `interval` → aantal dagen (+ anchor = vandaag by default); `weekdays` → dag-toggles
  (ma–zo); `monthdays` → dag-getallen (1–31). Hergebruik `Sheet`/`Button`/`Input`.

### 2e. Detail (`src/features/habits/pages/HabitDetailPage.tsx`)
- Streak, voltooiingspercentage (periode 4w/3m/alles), en een **heatmap**.
- Heatmap: generaliseer/kopieer `ConsistencyHeatmap` naar een variant die per dag een
  "done/scheduled/leeg"-status krijgt uit `doneByDate` + `isScheduledOn`.
- Acties: bewerken, archiveren (met `ConfirmDialog`).

---

## Fase 3 — Dashboard "Vandaag"-kaart

- `src/pages/DashboardPage.tsx` — nieuwe kaart "Habits vandaag": de op vandaag geplande,
  niet-gearchiveerde habits met voltooiingsgraad (x/y) en **direct afvinken** (dezelfde
  toggle/stepper als de dagweergave, via de Fase 1-writes). Tik op de kaarttitel → `/habits`.
- Hergebruik de bestaande dashboard-kaartstijl en `useHabits`/`useHabitLogs`.

---

## Fase 4 — E2E & verificatie

### E2E (Playwright, POM + fixtures; `docs/e2e-testing.md`)
- `e2e/pages/HabitsPage.ts` — acties: `gotoNew`, `create({name,type,target,schedule})`,
  `toggle(name)`, `stepCount(name)`, `prevDay/nextDay`, getters voor rijen/streak.
- `e2e/tests/habits.spec.ts` — o.a.:
  - maak een dagelijkse boolean-habit → verschijnt vandaag → afvinken → streak 1;
  - maak een count-habit met doel → tel tot doel → geldt als voltooid;
  - `weekdays`-habit verschijnt alleen op geplande dagen (navigeer een dag terug/vooruit);
  - dashboard-kaart toont de habit van vandaag en laat direct afvinken;
  - (optioneel) export → clear-all → import herstelt habits + logs.
- Eventueel één semantische `data-testid` (bv. `habit-row`) als er geen goede
  user-facing selector is; documenteren in de testid-tabel.

### Verificatie
- `npx tsc --noEmit`, `npm run build`, `npm run e2e:typecheck`, `npm run e2e` — groen.
- Handmatig (`npm run dev`): alle vier schematypes op de juiste dagen; afvinken/tellen
  schrijft één log per dag; streak slaat ongeplande dagen over; dashboard-afvinken werkt;
  export/import/clear-all round-trip.

---

## Nieuwe bestanden (overzicht)

```
src/features/habits/
  lib/schedule.ts
  hooks/useHabits.ts
  pages/HabitsPage.tsx
  pages/HabitFormPage.tsx
  pages/HabitDetailPage.tsx
  components/HabitHeatmap.tsx        # variant van ConsistencyHeatmap
e2e/pages/HabitsPage.ts
e2e/tests/habits.spec.ts
```

Gewijzigd: `src/db/index.ts`, `src/App.tsx`, `src/components/Layout.tsx`,
`src/pages/DashboardPage.tsx`, `src/lib/exportData.ts`, `src/lib/importData.ts`,
`src/features/training/db/seedDemoWorkouts.ts`.

## Aandachtspunten / grenzen

- **Nav-drukte:** opgelost via het "Meer"-menu (§2a) — Oefeningen, Schema's en
  Instellingen verhuizen uit de vaste balk, zodat die op vier dagelijkse tabs + "Meer"
  blijft.
- **Tijdzone:** gebruik lokale datum-keys (`localDateKey`), geen UTC, net als de
  bodyweight- en consistentie-features.
- **`monthdays` met 29–31:** die maanden simpelweg overslaan (geen clamping) — het minst
  verrassend voor streaks.
- **Herinneringen/notificaties** blijven buiten scope (apart traject).
