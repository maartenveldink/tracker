# Plan: AI-coach (schema-import + AI-analyse)

## Doel

1. Een schema kunnen importeren uit leesbare JSON (bijv. door een AI gemaakt).
2. Elke paar weken een AI vragen wat ik gedaan heb, waar ik achterblijf, en
   een aangepast schema laten voorstellen, rechtstreeks vanuit de app (route B).

De app blijft offline-first zonder backend. Alleen de analyse vraagt internet.

## Uitgangspunten

- Geen eigen backend: de PWA roept de Anthropic API direct aan vanuit de browser
  (header `anthropic-dangerous-direct-browser-access: true`).
- Het oude schema wordt nooit overschreven: een voorstel wordt als **nieuw schema**
  opgeslagen, zodat vergelijken en terugzetten kan.
- Structured output via tool use, dus altijd geldig JSON in plaats van tekst parsen.
- Analyse in het Nederlands.
- Route A (samenvatting kopiëren naar een AI-chat en JSON terug plakken) blijft
  bruikbaar als terugvaloptie en valt vanzelf af van stap 1 en 2.

## Huidige situatie

- `features/training/lib/schemaShare.ts`: compact formaat (`n`, `s`, `r`, `rm`, `w`, `g`),
  gecodeerd in `?importSchema=` (QR/link). Exercises worden op naam gematcht
  (hoofdletterongevoelig); onbekende namen worden als minimale oefening aangemaakt.
- `components/SchemaImportHandler.tsx`: bevestigingsdialoog voor de share-link.
- Instellingen heeft alleen een volledige data-import (`lib/importData.ts`).
- Er is geen UI om een los schema als JSON te plakken of te uploaden.

## Fasering

### Stap 1: Leesbaar schemaformaat + importscherm

- `features/training/lib/schemaJson.ts`
  - Type `SchemaJson` met volledige veldnamen:
    `name`, `days[]` of `exercises[]`, per oefening `exercise`, `sets`, `reps`,
    `repsMax?`, `startWeight?`, `restSeconds?`, `supersetGroup?`, `reason?`; `rotation?`.
  - Handmatige validatie met duidelijke, per-pad foutmeldingen (bruikbaar om terug
    te geven aan een AI). Geen `any`.
  - Mapping naar het bestaande interne importpad (hergebruik `importSharedSchema`
    of de gedeelde namen-resolutie eruit trekken).
  - Accepteert ook het compacte formaat (`v: 1`).
- `docs/schema-format.json`: JSON Schema van het formaat (voor in een prompt).
- Importscherm onder Schema's ("Importeer schema"): plakken of bestand kiezen,
  validatie, samenvatting, daarna dezelfde bevestiging als nu.
- E2E: geldige import, ongeldige import (fouten zichtbaar), onbekende oefening.

### Stap 2: Analyse-samenvatting + "Kopieer voor AI" (route A)

- `features/training/lib/coachSummary.ts`, bouwt compacte JSON over een periode
  (4 of 8 weken) uit bestaande `metrics` en `useProgress`:
  - per oefening: 1RM-trend (begin, eind, %), haalde rep-range per sessie,
    overgeslagen sets, gemiddeld gewicht en volume per week
  - volume per spiergroep + ondertrainde groepen
  - trainingsfrequentie en lichaamsgewichttrend
  - sessie- en oefennotities (vrije tekst)
  - huidig schema in het leesbare formaat
  - lijst met bestaande oefeningnamen
- Geen ruwe sets: bespaart tokens en privacy; doel is enkele duizenden tokens.
- Knop "Kopieer voor AI" met prompt + JSON Schema + samenvatting.
- Pure functie, dus makkelijk te testen via de bestaande fixtures.

### Stap 3: API-client en CoachPage (route B)

> **Status: gebouwd en daarna weer verwijderd** (route A volstaat; zie PR #3, `cb9f719`). De beschrijving hieronder is historisch.

- `features/training/lib/claudeCoach.ts`
  - `fetch` naar `https://api.anthropic.com/v1/messages`.
  - Eén tool `propose_schema` (input = JSON Schema uit stap 1 plus `analysis: string`),
    afgedwongen met `tool_choice`.
  - Prompt: bestaande oefennamen bij voorkeur gebruiken; nieuwe mogen, maar worden
    gemarkeerd; per wijziging een korte `reason`.
  - Foutafhandeling: geen key, 401, 429, netwerk/offline, ongeldig antwoord
    (valideren met stap 1 en foutmelding tonen).
- Sleutelopslag: zie "Beveiliging".
- `pages/CoachPage.tsx` (bereikbaar vanaf schema-detail, "Laat Claude analyseren"):
  - periode kiezen + optioneel doel/vraag ("meer rug", "knie-vriendelijk")
  - laadstatus
  - analysetekst
  - diff tegenover huidig schema met reden per wijziging, nieuwe oefeningen gemarkeerd
  - knop "Als nieuw schema opslaan"
- Instellingen: sectie "Claude-coach" (key, model, korte privacytoelichting).
- E2E: API gemockt met `page.route`; flow key invoeren, analyseren, voorstel zien,
  opslaan; ook de foutpaden.

### Stap 4 (optioneel): Herinnering

- Dashboardkaart "Het is X weken geleden, tijd voor een evaluatie", op basis van
  de datum van de laatste analyse.
- Laatste analyse (datum + tekst) bewaren zodat de volgende analyse kan vergelijken.

## Beveiliging en privacy

- **API-key niet in `AppSettings`:** die rij heeft sync-metadata (zie
  `docs/design.multi-user-sync.md`) en zit in de JSON-export. De key gaat in een
  aparte, niet-gesyncte en niet-geëxporteerde opslag (aparte Dexie-tabel of
  `localStorage`). Controleren dat `exportData` en sync hem niet meenemen.
- De key is leesbaar voor elk script op de pagina; acceptabel voor een persoonlijke
  app zonder externe scripts. Aanbevolen: lage maandlimiet op die key bij Anthropic.
- Trainingsdata gaat naar Anthropic: korte toelichting in het instellingenscherm.
- Service worker: de POST hoeft niet gecachet te worden; controleren dat er geen
  restrictieve CSP is (nu geen in `vite.config.ts`).

## Open punten

- Mag de AI nieuwe oefeningen voorstellen? Voorstel: ja, maar gemarkeerd in de diff.
- Standaardmodel (voorstel: Sonnet) en of het kiesbaar moet zijn.
- Bewaren van eerdere analyses (alleen laatste, of een historie)?

## Definition of done (per stap)

- `npx tsc --noEmit` en `npm run build` zonder fouten.
- `npm run e2e` en `npm run e2e:typecheck` groen, met nieuwe tests per stap.
- `CLAUDE.md` bijgewerkt (projectstructuur en geïmplementeerde epics).
