---
name: Project Stack & Architecture
description: Full tech stack and architectural decisions for the tracker fitness PWA
type: project
---

React 19 + Vite 6 + TypeScript (strict mode, noUncheckedIndexedAccess) PWA for fitness tracking.

**Why:** Personal offline-first fitness logger, single-user, no backend, no auth.

**Stack:**
- Styling: Tailwind CSS 3, dark theme (slate palette), mobile-first
- Database: Dexie.js 4 (IndexedDB), useLiveQuery for reactive reads
- Routing: React Router v7
- UI Components: shadcn/ui
- PWA: vite-plugin-pwa, autoUpdate service worker
- Charts: Recharts (ProgressPage)
- Node: 22

**Architecture:**
- src/db/ — types, DB singleton, seed data, muscle definitions
- src/hooks/ — data access + CRUD (no Redux/Zustand, Dexie replaces state management)
- src/components/ — shared UI (Layout, PageHeader, ConfirmDialog, MuscleChip)
- src/pages/ — route-level components
- Workout/SummaryPage have their own minimal layout (no bottom nav)

**Epics implemented:** E1 (exercises), E2 (schemas), E3 (live workout), E4 (progress/history)
**Not yet:** E5-6 (nutrition), E7 (Fitbit), E8 (settings full)

**How to apply:** Reviews should assume offline-first constraints, no server validation possible, IndexedDB as source of truth.
