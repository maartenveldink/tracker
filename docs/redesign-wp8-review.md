# WP8 Afwerking: review en open punten

Stand na WP8. Wat is gedaan, wat is gemeten, wat een mens in de browser moet bekijken.

## Gedaan (code)

- **Tokens:** `--color-destructive` (#c2410c, alleen vulling van knoppen, tekst erop 4,7:1) en `--color-danger` (#ff8a5c, fouttekst en iconen: 8,3:1 op `bg`, 7,5:1 op `surface`). `destructive` in `tailwind.config.js` is geen hex meer. Alle `text-destructive` zijn `text-danger`.
- **Geen warning/success-token (besluit):** succes en positief verschil = `accent`, data/delta = `accent-2`, fout = `danger`. Een extra kleur zou het palet verbreden zonder dat een scherm hem nodig heeft; heroverweeg als er een echte waarschuwingsstatus komt.
- **Typografie:** arbitraire `text-[13px]/[11px]/[10px]/[15px]/[22px]` vervangen door tokens (`text-small`, `text-nav`, `text-body`, `text-title`). Bewust nog arbitrair: `text-[9px]` (heatmap/kalender-badge), `text-[19px]` (knop xl, ontwerpmaat).
- **Tikdoelen >= 44px:** tab-triggers, kalender vorige/volgende/vandaag, rusttimerknoppen, habit omhoog/omlaag, en de kleine iconknoppen in workout-bewerken, suggestie, schema-editor. Bewust ongemoeid: het info-icoon in `ExerciseForm` (`tabIndex=-1`, aanvullend op de tekst).
- **Brede schermen:** de onderste navigatiebalk blijft binnen de 560px-kolom (de balk zelf loopt over de hele breedte).
- **Rusttimer:** tijdstempel-gebaseerd (geen drift in een achtergrondtab, herberekent bij `visibilitychange`); einde van de rust wordt eenmalig aangekondigd via een `aria-live="polite"`-regio (`rest-ended-announcement`).
- **Dashboard:** de "Aan de beurt"-kop is onzichtbaar tot de schema's geladen zijn (geen flits van "Voorgestelde training").
- **Habit-formulier:** "aantal dagen" kan leeg gewist worden tijdens het typen (waarde >= 1 bij blur/opslaan).
- **`recentTrainingStats`:** deelt door de weken sinds de eerste training (max. 8), niet altijd door 8 (met test).
- **PWA:** manifest `lang` is `nl`; `engines`/`prebuild` eisen Node >= 22.12 (Vitest 5).
- **e2e:** `a11y.spec.ts` (tikdoelen, nav-kolom op brede viewport).

Focusringen: een globale `:focus-visible`-outline (2px accent, offset 2) in `tokens.css` en `index.css` dekt ook knoppen zonder eigen ring (zoals "Zelfde als vorige" en de add-sheet-knoppen).

## Gemeten / nagelopen (statisch)

- Contrast tegen de tokens berekend (WCAG): text op bg 17,5:1, muted op bg 7,9:1 (op surface 7,1:1), accent op bg 14,8:1 (= on-accent op accent), accent-2 op surface 6,7:1, danger 8,3:1, `line-strong` op bg 3,7:1 (op surface 3,3:1). `line` (1,4:1) is alleen decoratief.
- Build: 20 precache-entries (1,39 MiB) inclusief de 5 self-hosted `woff2`-bestanden; geen verwijzing naar Google Fonts; `<html lang="nl">`, viewport en `theme-color` (#0A0E1A) staan in `index.html`, manifest heeft `display: standalone`, 192/512-iconen en `background_color`.

## Niet gemeten (Chromium draait lokaal niet: `libnspr4` ontbreekt)

- Een echte Lighthouse-run (PWA-installeerbaarheid, a11y-score, performance).
- Visuele vergelijking met `docs/design-handoff/screens/`.
- Schermlezer-gedrag (VoiceOver/TalkBack), o.a. de aankondiging van het einde van de rust.
- `npm run e2e` lokaal; CI draait het.

## Door een mens in de browser te bekijken

1. Lighthouse (mobiel + desktop) op de productie-URL: PWA-checks, a11y.
2. Het maskable icoon: `pwa-512x512.png` staat als `any maskable`; controleer of het logo binnen de safe zone past, anders aparte maskable-variant maken.
3. Desktopbreedte (>= 1024px): kolom gecentreerd, nav-inhoud in de kolom, sheets niet overbreed (sheets zijn nog niet tot 560px beperkt).
4. Live training en viering naast `screens/*.dc.html`.
5. Rusttimer in een achtergrondtab: telt na terugkeren correct bij.

## Open (buiten WP8)

- Sets per spiergroep (Progress) tellen ruwe spier-id's en niet gegroepeerd volgens de spierdetail-instelling.
- e2e `deleted-exercise` is af en toe flaky in CI; oorzaak niet vastgesteld (vermoeden: `toHaveCount(0)`-checks direct na `goto`, voordat de exercise-lookup geladen is).
- Er is geen aparte oefening-detailpagina (rij opent het formulier); detail/editor/import van schema's kregen alleen een token-pass; een gedeelde Textarea-component ontbreekt nog.
- Viering-banner overleeft geen reload (bewust, wacht op beslissing van de eigenaar).
