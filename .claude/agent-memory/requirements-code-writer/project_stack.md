---
name: Tracker project tech stack and MVP status
description: Tech stack decisions and which epics/requirements are implemented in the fitness tracker PWA
type: project
---

Tracker is a fitness PWA using React 19 + Vite 6 + TypeScript + Tailwind CSS 3 + Dexie.js 4 (IndexedDB) + vite-plugin-pwa. Node 22 required (.nvmrc).

**Why:** Stack chosen for offline-first PWA capability, no backend needed, broad React ecosystem.

**How to apply:** When implementing new features, follow the existing patterns: Dexie useLiveQuery for reads, async functions for writes, Tailwind dark theme (slate palette), mobile-first design. All data types are defined in src/db/index.ts.

MVP implemented: Epic 1 (exercises CRUD, search, filter, 25 seed exercises), Epic 2 (schemas CRUD, ordering, copy, muscle coverage analysis, suggestions), Epic 3 (live workout logging, pause/resume, summary), Epic 4 (progress page with 1RM chart via Recharts, session history, delete). Epic 5+6 (nutrition). Epic 8 (partial settings). Epic 9 (E9-01, E9-02, E9-05 implemented; E9-03/04/06 placeholder — Dexie v6 weekPlans table, feature at src/features/planner/).
