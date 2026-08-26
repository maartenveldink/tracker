# Requirements — Habit tracker

## Context & doel

Naast trainingen wil de gebruiker **dagelijkse gewoontes** bijhouden (bv. "8 glazen
water", "10.000 stappen", "stretchen", "eiwitdoel gehaald"): afvinken per dag, met
streaks en een heatmap in dezelfde stijl als de bestaande trainingsconsistentie.
De feature is offline-first (IndexedDB), single-user, geen backend — net als de rest
van de app.

Vastgestelde keuzes:

- **Entry point:** eigen **"Habits"-tab** in de bottom-nav **én** een afvinkbare
  **"Vandaag"-kaart op het dashboard**.
- **Nav-herindeling:** om de balk rustig te houden verhuizen **Oefeningen, Schema's en
  Instellingen** naar een nieuw **"Meer"-menu** (sheet). Vaste balk wordt dan:
  Home · Train · Progressie · Habits · Meer.
- **Habit-types:** **aan/uit** én **teller met doel**.
- **Schema per habit:** **dagelijks**, **elke-x-dagen**, **dag-van-week**,
  **dag-van-maand**.
- **Buiten scope v1:** herinneringen/notificaties (apart geparkeerd).

## Functionele requirements

| ID | Requirement |
|----|-------------|
| HT-01 | Gebruiker kan een habit aanmaken, bewerken en archiveren (naam, emoji, kleur). Gearchiveerde habits verdwijnen uit de dagweergave maar behouden hun historie. |
| HT-02 | Per habit een **type**: `boolean` (gedaan/niet) of `count` (teller met `target`, bv. 8). |
| HT-03 | Per habit een **schema** (zie tabel "Schema-opties"): dagelijks, elke-x-dagen, dag-van-week, of dag-van-maand. |
| HT-04 | **Dagweergave**: de habits die op de gekozen dag "gepland" zijn, met afvinken (boolean) of +/- teller tot het doel (count). |
| HT-05 | Navigeren naar eerdere dagen om te loggen/corrigeren. **Vooruit loggen** (toekomst) is niet toegestaan. |
| HT-06 | Per habit een **streak**: aantal opeenvolgende geplande dagen dat de habit voltooid is (niet-geplande dagen worden overgeslagen, niet gebroken). |
| HT-07 | Per habit een **voltooiingspercentage** over een periode (4 weken / 3 maanden / alles). |
| HT-08 | Per habit een **heatmap** (26 weken), hergebruik van de bestaande `ConsistencyHeatmap`-stijl; alleen geplande dagen kleuren. |
| HT-09 | Habits **herordenen** (volgorde in dag- en dashboardweergave). |
| HT-10 | **Dashboard-kaart "Vandaag"**: de habits van vandaag met voltooiingsgraad; direct afvinkbaar zonder de Habits-pagina te openen. |
| HT-11 | Habits én logs zitten in de bestaande JSON **export/import** en worden gewist door **clear-all** (Instellingen → databeheer). |
| HT-12 | Een habit als "voltooid" telt: bij `boolean` een log met waarde 1; bij `count` een log met waarde ≥ `target`. |

## Schema-opties

| `kind` | Parameters | "Gepland op datum D" wanneer |
|--------|-----------|------------------------------|
| `daily` | — | altijd |
| `interval` | `everyDays` (≥1), `anchor` (YYYY-MM-DD) | `D ≥ anchor` en `daysBetween(anchor, D) % everyDays === 0` |
| `weekdays` | `days` (ISO 1=ma … 7=zo) | `isoWeekday(D) ∈ days` |
| `monthdays` | `days` (1–31) | `dayOfMonth(D) ∈ days`; dagen die in een maand niet bestaan (bv. 31 in feb) worden die maand overgeslagen |

## Datamodel (nieuw, Dexie DB v16)

| Entity | Velden | Toelichting |
|--------|--------|-------------|
| `Habit` | `id?`, `name`, `emoji?`, `color?`, `type: 'boolean' \| 'count'`, `target?` (bij `count`, ≥1), `schedule: HabitSchedule`, `order`, `archived: boolean`, `createdAt` | Definitie van de gewoonte. |
| `HabitLog` | `id?`, `habitId`, `date: 'YYYY-MM-DD'`, `value: number`, `createdAt` | Eén rij per habit per dag. `value` = 0/1 bij boolean, het getelde aantal bij count. Zelfde per-dag patroon als `BodyWeightEntry` (`src/db/index.ts:159`). |

`HabitSchedule` is een discriminated union:

```ts
type HabitSchedule =
  | { kind: 'daily' }
  | { kind: 'interval'; everyDays: number; anchor: string } // YYYY-MM-DD
  | { kind: 'weekdays'; days: number[] }   // 1=ma … 7=zo
  | { kind: 'monthdays'; days: number[] };  // 1..31
```

Dexie stores (nieuw): `habits: '++id, order, archived'`,
`habitLogs: '++id, habitId, date, [habitId+date]'`. Geen migratie van bestaande data
nodig; alleen nieuwe stores in `.version(16)`.

## UI / pagina's

| Scherm | Route | Inhoud |
|--------|-------|--------|
| Habits — dag | `/habits` | Datumkiezer (vandaag standaard, terug navigeerbaar) + lijst van geplande habits met afvink-/tellercontrole; per rij mini-streak. |
| Habit — detail | `/habits/:id` | Heatmap, streak, voltooiingspercentage per periode; knoppen bewerken/archiveren. |
| Habit — formulier | `/habits/new`, `/habits/:id/edit` | Naam, emoji, kleur, type (+ doel), schema-keuze met bijbehorende parameters. |
| Dashboard-kaart | `/` | "Vandaag": geplande habits + voltooiingsgraad, direct afvinkbaar. |
| Navigatie | — | Bottom-nav: Home · Train · Progressie · **Habits** · **Meer**. "Meer" opent een sheet met Oefeningen, Schema's en Instellingen. |

## Hergebruik uit de codebase

| Bestaand | Inzet |
|----------|-------|
| `BodyWeightEntry` (`src/db/index.ts:159`) + `useBodyWeight` + `BodyWeightSection` | Blauwdruk voor het per-dag log-patroon en de sectie-UI. |
| `metrics.ts`: `localDateKey`, `trainingDayCounts`, `getISOWeek` | Datum-keys en dag-aggregatie. |
| `ConsistencyHeatmap` | Basis voor de per-habit heatmap. |
| `calculateStreak` (wekelijks) | Referentie; er komt een **dagelijkse, schema-bewuste** streak-helper bij. |
| Dashboard-kaartpatroon (`DashboardPage.tsx`) | De "Vandaag"-kaart. |
| `Layout` bottom-nav | Toevoegen van de Habits-tab. |
| `exportData` / `importData` + clear-all (Instellingen) | Habits/logs meenemen in databeheer. |

## Niet-functioneel

- Offline-first (IndexedDB via Dexie), reactieve reads met `useLiveQuery`.
- TypeScript strict, geen `any`; dark, mobile-first (slate).
- DB-migratie naar **v16** (alleen nieuwe stores).
- E2E-tests (Page Object Model + specs) volgens `docs/e2e-testing.md`.

## Buiten scope (v1)

- **Herinneringen/notificaties** (apart traject).
- Weekdoelen als "3× per week" (i.p.v. concrete geplande dagen).
- Delen van habits en cross-correlaties (bv. "beter getraind na goede slaap").

## Acceptatiecriteria (klaar wanneer)

- Een habit met elk schematype toont op de juiste dagen in de dagweergave, en niet op
  ongeplande dagen.
- Afvinken/tellen schrijft één `HabitLog` per dag; opnieuw tikken corrigeert dezelfde rij.
- Streak telt opeenvolgende geplande, voltooide dagen en overslaat ongeplande dagen.
- De dashboard-kaart toont de habits van vandaag en laat direct afvinken.
- Export → wipe → import herstelt habits én logs; clear-all wist ze.
- `npx tsc --noEmit`, `npm run build`, `npm run e2e` zijn groen.
