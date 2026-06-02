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
```

## Project Structure

```
src/
  db/             # Dexie database, types, seed data, muscle definitions
    index.ts      # DB class, all entity types (Exercise, TrainingSchema, Workout, etc.)
    muscles.ts    # Standardised muscle group definitions (global + detailed)
    seed.ts       # 25 default exercises with muscle group mappings
  hooks/          # Data access hooks and CRUD operations
    useExercises.ts
    useSchemas.ts
    useWorkout.ts
  components/     # Shared UI components
    Layout.tsx    # Bottom nav + outlet
    PageHeader.tsx
    ConfirmDialog.tsx
    MuscleChip.tsx
  pages/          # Route-level page components
    ExercisesPage.tsx      # Epic 1: exercise list with search/filter
    ExerciseFormPage.tsx   # Epic 1: create/edit exercise
    SchemasPage.tsx        # Epic 2: schema list
    SchemaFormPage.tsx     # Epic 2: create/edit schema with exercise ordering
    SchemaDetailPage.tsx   # Epic 2: schema detail with muscle coverage analysis
    StartWorkoutPage.tsx   # Epic 3: start from schema or ad-hoc
    WorkoutPage.tsx        # Epic 3: live training logging (minimal UI)
    WorkoutSummaryPage.tsx # Epic 3: post-workout summary
  App.tsx         # Route definitions
  main.tsx        # Entry point (seeds DB, renders app)
  index.css       # Tailwind directives
```

## Conventions

- **Language:** TypeScript strict mode, no `any`
- **Styling:** Tailwind utility classes, dark theme (slate palette), mobile-first
- **Data access:** Dexie `useLiveQuery` for reactive reads; plain async functions for writes
- **Components:** Function components, no class components
- **Naming:** PascalCase for components, camelCase for hooks/functions, kebab-case for files would be fine but currently PascalCase for pages/components
- **No external state management:** Dexie live queries replace Redux/Zustand

## Implemented Epics (MVP)

- **Epic 1** (E1-01 to E1-05): Exercise & muscle database — CRUD, search, filter, seed data
- **Epic 2** (E2-01 to E2-07): Training schemas — CRUD, exercise ordering, copy, muscle coverage analysis, suggestions
- **Epic 3** (E3-01 to E3-09): Live workout logging — start from schema/ad-hoc, set logging, pause/resume, summary
- **Epic 4** (E4-01 to E4-05, E4-06 gedeeltelijk): Training history per exercise with 1RM chart and session list; delete workout (edit not yet implemented)
- **Epic 8** (E8-05, E8-06): Settings — clear all data, load demo dataset; 1RM formula/muscle detail UI not yet implemented

## Not Yet Implemented

- Epic 5-6: Nutrition tracking
- Epic 7: Fitbit integration
- Epic 8 (partial): 1RM formula choice (E8-01), muscle detail level (E8-02), macro goals (E8-03)
