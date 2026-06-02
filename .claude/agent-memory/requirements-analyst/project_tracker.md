---
name: Tracker App — Project Context
description: Core facts about the Tracker fitness PWA: domain, tech stack, implemented epics, requirements document location, and next iteration plan
type: project
---

Tracker is a single-user personal fitness PWA (React 19 + Vite 6 + TypeScript + Dexie.js/IndexedDB, shadcn/ui). Offline-first, no backend, no auth. Primary language of the codebase and requirements document is Dutch.

Requirements document: `/docs/requirements.md` (v1.2, 2026-06-02).

**Implemented epics (as of 2026-06-02):**
- Epic 1 (E1-01–E1-05): Exercise & muscle database — CRUD, search, filter, 25 seed exercises
- Epic 2 (E2-01–E2-07): Training schemas — CRUD, exercise ordering, copy, muscle coverage analysis, suggestions
- Epic 3 (E3-01–E3-09): Live workout logging — start from schema/ad-hoc, set logging, pause/resume, summary
- Epic 4 (E4-01–E4-06): Progress & history — partially. E4-01 t/m E4-05 = volledig. E4-06 = ~ (verwijderen wel, bewerken niet).
- Epic 8 (E8-05, E8-06): Settings — data wissen en voorbeelddata laden zijn geimplementeerd.
- CLAUDE.md incorrect lists Epic 4 as "Not Yet Implemented" — requirements.md is authoritative.

**Not yet implemented:** Epic 5–6 (nutrition), Epic 7 (Fitbit), Epic 8 functional settings (E8-01 to E8-04).

**Planned iterations (defined 2026-06-02, see /docs/next-iteration-plan.md):**
- Iteratie 1 — MVP afronden: E4-07 (workout bewerken — nieuwe ID), E4-08 (trainingsbewerking), E3-10 (vorige prestatie als referentie), E8-01 (1RM-formule keuze), E8-02 (spiergroepdetailniveau keuze), E8-04 (instellingen persistent opslaan)
- Iteratie 2 — Voedingsmodule: Epic 5 volledig (E5-01–E5-10), Epic 6 volledig (E6-01–E6-08), E8-03 (macrodoelen instellen)
- Iteratie 3 — Dataportabiliteit: E8-07 (JSON export), E8-08 (JSON import), NF-07 (export format), NF-08 (import validatie), NF-09 (camera/barcode permission)

**New requirement IDs introduced in next-iteration-plan.md:**
- E3-10, E4-07, E4-08, E4-09, E5-09, E5-10, E6-07, E6-08, E8-07, E8-08, NF-07, NF-08, NF-09

**Aanbeveling vastgelegd:** Voedingsmodule (Iteratie 2) na het afronden van de trainingsmodule (Iteratie 1), niet parallel — om technische schuld in de instellingenlaag te voorkomen en de gebruiker een stabiel MVP te geven voor voedingsdata begint.

**Why:** Requirements review and planning work. Shape suggestions around the tabular format used in the existing requirements document. No user stories, no markdown headers in tables.

**How to apply:** Bij nieuwe requirements altijd eerst nagaan of er al een ID bestaat in /docs/next-iteration-plan.md. Vermijd dubbele IDs. Gebruik het tabelvormige format van requirements.md.
