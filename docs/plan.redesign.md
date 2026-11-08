# Plan: Tracker-makeover

Bron: `docs/design-handoff/` (uit Claude Design). Lees daar `DESIGN.md` (bron van waarheid voor
uiterlijk), `tokens/` en `screens/*.dc.html` (leesbare specificatie, draait niet los).
`AGENT_PROMPT.md` in die map is de generieke opdracht; dit plan is de repo-specifieke uitwerking.

Regel: repo wint voor gedrag en data, het ontwerp wint voor uiterlijk. Geen wijzigingen aan
datamodel, sync of API tenzij een stap dat expliciet noemt.

## 1. Inventaris (nu al bekend)

Antwoorden op DESIGN.md §12, om agents tijd te besparen. Agents verifiëren ze in stap 0.

| # | Vraag | Bevinding |
|---|---|---|
| 1 | Techniek | React 19 + Vite + **Tailwind 3** (niet v4: gebruik de v3-route uit DESIGN.md §3) + shadcn-achtige `src/components/ui/*`. Kleuren zijn HSL-variabelen (`--background`, `--primary`, ...) in `src/index.css` en `tailwind.config.js`. |
| 1 | Routes | `/` Dashboard, `/start`, `/start/suggestion`, `/start/history`, `/habits`, `/progress`, `/exercises`, `/schemas`, `/schemas/:id/edit`, `/settings`, `/workout/:id` (+ `/edit`, `/summary`). Training = `/workout/:id` (eigen layout, geen nav). |
| 1 | Nav | `src/components/Layout.tsx`: Home, Train, Habits, Progressie + "Meer"-sheet (Oefeningen, Schema's, Instellingen). Komt al overeen met het ontwerp. |
| 2 | Voorgestelde training | `SuggestWorkoutPage`, `lib/` in `features/training`; behouden. Vorige-sessiedata bestaat (weight prefill/carry-over, previous-session refs). |
| 5 | Bestaande viering | Zoek in `WorkoutPage`/`WorkoutSummaryPage`/`lib/metrics`; koppel aan trigger uit DESIGN.md §8. |
| - | Habits | **Bestaan** (`src/features/habits`, `docs/plan.habit-tracker.md`), ook al noemt `CLAUDE.md` ze niet. |
| - | Tests | Alleen Playwright e2e (`e2e/`, Page Objects). **Er zijn geen unit tests**: DESIGN.md vraagt eenheidstests voor §6/§7/§8-logica. Beslis in stap 0: Vitest toevoegen (aanbevolen, kleine devDependency) of via e2e dekken. |
| - | `theme-color` | `index.html` en `vite.config.ts` (manifest) staan op `#1e293b` -> `#0A0E1A`. |

Beslissingen (stand 2026-11-08):
1. **Lichaamsgewicht en 1RM: uitgesteld.** Voorlopig worden sets zonder gewicht (zie `lib/sets.ts`: `isWeightedSet`) buiten de 1RM-berekeningen gehouden. Gevolg: oefeningen zonder gewogen sets krijgen geen 1RM-grafiek, geen PR en geen viering. Kom hier later op terug (DESIGN §12.4).
2. **"Beter dan vorige keer" = gemiddeld geschat 1RM over alle gewogen sets van de oefening** (vandaag t.o.v. de vorige sessie van dezelfde oefening), in plaats van totaalvolume (DESIGN §8/§12.6).
   - Epley per set: `gewicht x (1 + herhalingen/30)`; 1 herhaling = gewicht. Gemiddelde over alle gewogen, afgeronde sets van die sessie.
   - Beter = gemiddelde vandaag > gemiddelde vorige sessie. Geen vorige sessie, of geen gewogen sets: geen viering.
   - Een extra set verhoogt de score niet vanzelf; een lichte extra set kan hem zelfs verlagen. Dat is bedoeld.
   - Sets met meer dan 12 herhalingen tellen niet mee (consistent met DESIGN §7). Als daardoor niets overblijft: geen viering.
   - Banner-subregel (DESIGN §8) wordt `+{x} kg geschat 1RM`; het deel `+n herhalingen` blijft alleen als herhalingen in totaal toenamen. Het volume-deel vervalt. Per-setverschil in de vergelijkingstabel blijft zoals ontworpen.
   - Eén pure functie in `features/training/lib/` (bv. `improvement.ts`) met unit tests; ook voor het "Beter dan"-label elders gebruikt.
3. **Volume-delta in de tile: uitgesteld.** Tot er een besluit is: vorige week volledig, zoals in het ontwerp (DESIGN §12.7). Bouw het zo dat de vergelijkingsperiode op één plek staat.
4. **Vitest: ja, maar zuinig.** Alleen unit tests voor pure logica die echt kan misgaan: de trainingsstatemachine (DESIGN §6, vooral de zoekregel voor de huidige oefening), de viering-trigger (beslissing 2) en de afgeleide berekeningen uit §7 (1RM, plateau, 7-daags gemiddelde). Geen tests voor UI, componenten of triviale helpers; UI blijft via de bestaande e2e gedekt.

## 2. Aanpak en risico's

- **Tokens eerst, schermen daarna.** De app gebruikt shadcn-HSL-variabelen. Het goedkoopste fundament is die variabelen te herdefiniëren naar de ontwerp-tokens (en `tokens.css` te importeren). Dan krijgt elk scherm al grotendeels de nieuwe kleuren zonder aanraking, en worden schermen daarna per stuk aangepast.
- **Geen losse hex-waarden** in herontworpen schermen (bestaande `slate-*`-klassen vervangen door token-klassen).
- **Houd e2e groen.** Selectors in `e2e/pages/*` zijn waarschijnlijk op rol/tekst; behoud labels en `aria`-namen, of werk de Page Objects in dezelfde PR bij.
- **Het ontwerp is zonder code gemaakt**: Training en Progressie-grafieken zijn voorstellen. Wijkt data/gedrag af, volg de repo en noteer de afwijking in de PR.
- **Niet ontworpen** (patroon volgen, niet vrij ontwerpen): formulier nieuwe habit/oefening, oefening-detail, bevestigingsdialogen, laad/foutstaten, licht thema. Zie DESIGN §2.
- `HomeB`/`HomeC` zijn alleen kleurvarianten: niet bouwen.
- Fonts (Inter, Space Grotesk): bij voorkeur **self-hosten** (`@fontsource-*`) i.p.v. Google Fonts; de app is offline-first/PWA en moet fonts precachen.
- Beweging: overal `prefers-reduced-motion`.

## 3. Werkpakketten

Elk pakket = eigen branch + PR vanaf `main`, `npm run build` + `npm run e2e` groen. "Afhankelijk"
geeft volgorde; pakketten zonder afhankelijkheid kunnen parallel.

### WP0 Besluiten en testbasis (klein, eerst)
- Alle vier de beslissingen zijn genomen of bewust uitgesteld (zie §1).
- Voeg Vitest toe met `npm test`; houd de testset klein (zie beslissing 4).
- Documenteer Vitest in `CLAUDE.md` (Testing-sectie: "geen unit tests" klopt dan niet meer).
- Update `CLAUDE.md`: habits, design-handoff, nieuwe conventies.

### WP1 Fundament (blokkeert alles)
- `tokens.css` importeren; shadcn-HSL-variabelen en `tailwind.config.js` mappen naar de tokens (`bg`, `surface`, `line`, `line-strong`, `text`, `muted`, `accent`, `on-accent`, `accent-2`, radii, spacing, fonts).
- Fonts self-hosted, `font-display: swap`, alleen gewichten uit §3.
- `theme-color` + PWA-manifest, globale basisstijl (`color-scheme: dark`, focus-visible: 2 px accent, offset 2).
- Basiscomponenten in `src/components/ui/` aanpassen volgens DESIGN §4: Button (primair 56/64, secundair, tekst), Card, Chip/Segmented, Input (48 hoog, `line-strong`), Switch (`role="switch"`), Sheet (radius 28), Progress bar, Stat-tile, List row.
- `Layout.tsx`: navigatiebalk (76 hoog, iconen 24, labels 11) + Meer-sheet; content max 560 px gecentreerd op breed scherm.
- Klaar als: de hele app is gethemed zonder brekende layout; e2e groen.

### WP2 Home / Dashboard   (afh. WP1)
`DashboardPage` volgens `Main.dc.html` + `HomeLeeg.dc.html`: hero "Aan de beurt", weekkaart, drie tiles (streak, volume + delta, gewicht + "+ Log"), "Laatst getraind". Hergebruik `lib/metrics`; nieuwe afgeleide waarden (laatst getraind per spiergroep) als pure functies in `lib/`.

### WP3 Start training   (afh. WP1, parallel met WP2)
`StartWorkoutPage` volgens `Train.dc.html`: voorgestelde training met 2 px accentrand, schemadagen, stippelrij Vrije training.

### WP4 Live training  (afh. WP1; grootste waarde, bij voorkeur 1 agent)
`WorkoutPage` volgens `Training.dc.html` + DESIGN §5/§6: header zonder nav, setlijst met drie toestanden, vaste onderbalk met stappers en "Set klaar" (64), rusttimer-strook, set toevoegen/weghalen, oefening overslaan, oefeningenoverzicht-sheet, klaar-toestand, bevestigingssheet bij "Afronden", wake lock, elke set direct opslaan.
- Statemachine (`todo/done/skipped`, zoekregel voor "huidige oefening") als **pure functie** in `features/training/lib/` + unit tests (WP0).
- Behoud bestaande functies: supersets, rest-resolutie (`restTime.ts`), invoegpositie (`insertPosition.ts`), voorinvulling, progressive overload.
- Kan eventueel gesplitst: 4a statemachine + tests, 4b UI.

### WP5 Viering   (afh. WP4)
Trigger = gemiddeld geschat 1RM (beslissing 2, niet totaalvolume zoals DESIGN §8), banner, vergelijkingstabel, confetti/vuurwerk (deterministische pseudo-random, `aria-hidden`), instelling "Viering bij verbetering" + "Trillen" in Instellingen, reduced motion. Trigger-logica als pure functie + tests. Verwijder/koppel de bestaande verbeteringsanimatie.

### WP6 Progressie  (afh. WP1, parallel met WP4)
`ProgressPage`: segmented Oefeningen | Overzicht | Gewicht (`?tab=` blijft werken, o.a. `?tab=overview`). Bestaande secties (records, heatmap, kalender, volume-trend, lichaamsgewicht, history) opnieuw plaatsen in het nieuwe ontwerp; verlies **geen** bestaande feature zonder dat de eigenaar dat beslist (kalender, heatmap, goals, deload staan niet in het ontwerp!). Nieuw: plateau-signaal, sets per spiergroep, 7-daags gemiddelde. Grafieken: recharts is al aanwezig (lazy); houd het daarbij of eigen SVG, met `role="img"` + `aria-label`.

### WP7 Overige schermen  (afh. WP1, elk apart te verdelen)
- 7a Habits (+ detail/formulier volgens patroon)
- 7b Oefeningen (+ formulier/detail volgens patroon)
- 7c Schema's, Schema bewerken, schema-detail/import
- 7d Instellingen (groepen "Training" en "Gegevens"; behoud alle bestaande opties)
- 7e Workout-samenvatting/-bewerken/-historie (niet ontworpen: patroon volgen)
- 7f Loginscherm en foutscherm (`ErrorBoundary`) in de nieuwe stijl

### WP8 Afwerking  (laatst)
Toegankelijkheidspass (§11: labels, `aria-*`, contrast, tikdoelen >= 44), reduced motion, brede schermen (560 px kolom), e2e-aanvullingen, `CLAUDE.md` + `docs/` bijwerken, Lighthouse/PWA-check, visuele review tegen `screens/`.

## 4. Volgorde en parallellisme

```
WP0 -> WP1 -> { WP2, WP3, WP4, WP6, WP7a-f }  (parallel, verschillende bestanden)
                         WP4 -> WP5
                         alles -> WP8
```

Bestandsconflicten: WP1 raakt `index.css`, `tailwind.config.js`, `ui/*`, `Layout.tsx`. Wacht met de
rest tot WP1 gemerged is. Daarna raken pakketten vrijwel disjuncte pagina's; `SettingsPage` wordt
door WP5 (toggles) en WP7d geraakt, laat WP7d eerst of voeg de toggles daarin samen.

## 5. Agentopdracht (per pakket)

> Werk op een eigen branch vanaf `main`. Lees `docs/design-handoff/DESIGN.md` en het scherm-bestand
> van jouw pakket, plus `docs/plan.redesign.md`. Gebruik tokens, geen losse hex-waarden. Verander
> geen datamodel/sync/API. Behoud bestaande features en e2e-labels, of pas de Page Objects mee aan.
> Draai `npm run build` en `npm run e2e` (en `npm run e2e:typecheck` bij testwijzigingen). Lever
> een korte samenvatting: wat gebouwd, wat afgeweken, open vragen. Mergen na review van de eigenaar.

## 6. Definition of done (totaal)

Zie DESIGN §13 "Klaar als", plus: e2e groen, geen verloren features t.o.v. `CLAUDE.md` (Implemented
Epics), PWA offline werkend met self-hosted fonts.
