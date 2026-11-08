# Plan — Data op de server persisteren (alles op de ene prod-server)

Bij `docs/requirements.server-persistence.md` (ID's `R-xx`) en
`docs/design.multi-user-sync.md` (datamodel, sync-regels). Lees die eerst.

Geschreven om door een AI-agent in stappen opgepakt te worden. Een fase is klaar
als de **klaar-wanneer**-regel waar is. Stop bij een rode regel en meld het.

## Status

- **Gebouwd en lokaal rooktest gedaan** (op verzoek geen aparte DevBox-fase meer): `Dockerfile`,
  `.dockerignore`, `server/entrypoint.sh`, `server/pb_hooks/signup.pb.js`, `same-origin`-modus in
  `src/lib/pb.ts`, `server/README.md`, `CLAUDE.md`. De migratie was stuk (geen `username`-veld,
  `email` verplicht) en is hersteld. Getest in Docker: health, PWA en SPA-routes, registratie
  (eerste account ja, tweede 403), login, per-user isolatie, data overleeft het opnieuw aanmaken
  van de container met een mount op `/data`.
- **Nog te doen:** fase 4 (naar prod), met persistentietest op prod (R-00); sync handmatig testen
  in de browser (fase 2); e2e-sync-spec (fase 3).
- `server/Caddyfile`, `docker-compose.yml`, `deploy.sh`, `.env.example` zijn verwijderd (R-44).

## Regels voor de uitvoerder

- Werk op een feature-branch, niet op `main`. Commit en push alleen als de
  gebruiker erom vraagt.
- Elke stap die prod raakt (deploy, secrets) vraagt eerst bevestiging. Uitrollen
  gaat vanaf de DevBox met `prod-cli deploy` (de `prod`-MCP kan lezen en de
  deploy voorbereiden, niet uploaden).
- Er komt **geen wegwerp-app op prod** (besluit O-2). Testen van Docker en
  PocketBase gebeurt op de DevBox met de MCP `release-scripting` (`run_app`).
- **Er gaat geen echte data naar prod voordat R-00 (persistentie op prod) bewezen
  is** met een testrecord op de echte `tracker`-app. Een deploy zonder persistente
  opslag wist de database.
- Vraag nooit om wachtwoorden of tokens in de chat. Secrets zet een mens op
  `https://beheer.app.bobreijnders.nl/apps/<app>/env`; de app moet er al zijn.
- Maak vóór de eerste sync een JSON-export van de lokale data (R-21).
- Herschrijf de bestaande sync-engine en migratie (Dexie v17–v20) niet; test ze
  eerst (fase 2) en fix alleen aangetoonde fouten.
- TypeScript strict, geen `any`; volg `CLAUDE.md`.

## Fase 0 — Docker en PocketBase testen op de DevBox (geen prod)

Doel: bewijzen dat de container werkt, vóór er iets naar prod gaat. Dit bewijst
niet dat prod data bewaart; dat doet fase 4.

1. Controleer de DevBox: `check_setup` van de MCP `release-scripting`.
2. Bouw in fase 1 de `Dockerfile` en test hem hier met `run_app` (app-naam bijv.
   `tracker-test`, URL `https://tracker-test.hetzner.bobreijnders.nl`; naam met de
   gebruiker afstemmen, `stop_app` na afloop). `run_app` laat eigen Dockerfiles
   ongemoeid; een gegenereerde `compose.yaml` mag je aanpassen voor een volume.
3. Test op de DevBox: de multi-stage build slaagt met `ARG VITE_PB_URL`; PocketBase
   luistert op `0.0.0.0:8080`; `/api/health` en de statische PWA werken; een record
   overleeft `rebuild: true` als `pb_data` op een volume staat.

**Klaar-wanneer:** de bovenstaande punten zijn gedraaid en vastgelegd in
`docs/server-persistence.spike.md` (commando's, uitkomst, gekozen datapad).

## Fase 1 — Baseline en Dockerfile in de repo (geen prod)

1. Branch, `git status` schoon. `npx tsc --noEmit`, `npm run build`, `npm run e2e` groen.
2. Lees `src/lib/sync/engine.ts`, `src/lib/pb.ts`, `src/features/auth/*`, `server/`,
   `e2e/fixtures/app.ts`.
3. Controleer dat `server/pb_migrations/` alle 7 collecties uit het ontwerp bevat en
   dat de API-rules op `user` scopen (R-03, E-01).
4. Maak `Dockerfile` in de projectroot:
   - stage 1 (node 22): `npm ci`, `ARG VITE_PB_URL`, `npm run build`.
   - stage 2: gepinde PocketBase 0.28.4; kopieer `dist` naar `pb_public` en
     `server/pb_migrations` naar `pb_migrations`; data-map op het pad uit fase 0;
     `CMD serve --http=0.0.0.0:8080 --dir=<datapad> --publicDir=pb_public --migrationsDir=pb_migrations`.
   - SPA-fallback: controleer dat PocketBase onbekende paden naar `index.html` stuurt
     (`serve --indexFallback`, standaard aan); zo niet, oplossen (R-02).
   - Geen secrets in het image (R-05). Admin aanmaken via env of de eerste-start-URL.
5. `.dockerignore` (node_modules, dist, test-resultaten, `.env`, exports met persoonlijke data).
6. Lokaal bouwen en draaien: `docker build --build-arg VITE_PB_URL=http://localhost:8080 -t tracker .`
   en `docker run -p 8080:8080 -v $PWD/.pbdata:<datapad> tracker`, en daarna via `run_app` (fase 0).
7. R-44: markeer `server/Caddyfile` en `docker-compose.yml` als niet gebruikt op prod,
   of verwijder ze met de gebruiker; update `server/README.md`.

**Klaar-wanneer:** lokaal staat de app op `http://localhost:8080`, `/api/health` = 200,
SPA-routes laden bij verversen, migraties bouwen alle collecties op.

## Fase 2 — Sync testen tegen die lokale container (R-12, R-13, R-22, R-23, R-32)

1. Handmatig scenario (resultaat per stap noteren): registreren → workout loggen →
   tweede browserprofiel inloggen → data gelijk → container stoppen, offline workout
   loggen → container starten → achterstand synct → schema verwijderen op A verdwijnt
   op B → conflict op beide kanten (LWW).
2. R-13: `tracker.coach.*` komt niet in PocketBase (admin-UI inspecteren).
3. R-23: defaults niet verdubbeld na de eerste sync.
4. R-12: DevTools → Application: geen API-responses in de SW-cache.
5. Fix aangetoonde bugs in kleine commits, met een regressietest waar mogelijk.

**Klaar-wanneer:** scenario slaagt zonder consolefouten; bugs gefixt of gedocumenteerd.

## Fase 3 — e2e en documentatie (R-40..R-43)

1. Lees `docs/e2e-testing.md`. Voeg een sync-spec toe in `e2e/tests/` (login, push,
   pull op tweede context), gemockt via Playwright-routes zoals `mockAnthropic`, of tegen
   de lokale container als de fixtures dat ondersteunen.
2. Werk `CLAUDE.md` bij: backend/auth/sync, `VITE_PB_URL`, Dockerfile, nieuwe deploy-sectie,
   persistentieplek, back-upprocedure, en de habits-feature (staat nu niet in het overzicht).
3. `npx tsc --noEmit`, `npm run e2e:typecheck`, `npm run e2e`, `npm run build`.

**Klaar-wanneer:** alle vier slagen.

## Fase 4 — Naar prod (R-01..R-07, R-14, R-20..R-23, R-33)

Bevestig met de gebruiker vóór elke stap.

0. **Vereist:** antwoord op O-5 (hoe krijgt een app op prod een persistente schijf). De
   gebruiker beheert prod zelf; hij zet dat op de server of de beheerpagina. Zonder dit
   gaat deze fase niet verder.
1. Gebruiker maakt een JSON-export in de live app en bewaart die buiten de browser (R-21).
2. Commit de wijzigingen (Dockerfile e.d.) op de deploybranch. De Dockerfile bouwt de PWA zelf,
   dus `dist/` hoeft niet meer in HEAD (alleen bij terugval uit fase 0).
3. Eerste deploy over de bestaande app:
   `prod-cli deploy --name tracker --domain app.maartenveldink.nl` (met `--kind` zoals fase 0 bepaalde).
   Dezelfde naam, dus de bestaande app wordt vervangen. Dit is het moment waarop de huidige
   versie verdwijnt; de lokale data in de browser blijft staan.
4. Mens zet de admin-secrets (R-04) en rolt opnieuw uit zodat ze actief zijn.
5. `/api/health` 200, loginscherm zichtbaar. **Persistentietest (R-00) met een testrecord:**
   maak in de admin-UI een testrecord, rol met `prod-cli deploy` opnieuw uit en controleer dat het er
   nog is. Staat het er niet meer: stop, er gaat geen echte data heen.
   Daarna account aanmaken en open registratie uitzetten (R-14).
6. Op het apparaat met de bestaande data inloggen, één sync-cyclus wachten. Tel records per
   tabel lokaal en in PocketBase (R-20). Tweede profiel: R-22.
7. **R-33:** nog een kleine wijziging deployen en controleren dat alle echte records er nog zijn.

**Klaar-wanneer:** R-01..R-07, R-14, R-20..R-23 en R-33 aantoonbaar op prod. Bij een mismatch in
aantallen: niet verder, de export uit stap 1 is de terugval.

## Fase 5 — Afronden (back-up is uitgesteld, O-3)

1. R-32 op prod: een herdeploy tijdens het loggen; de app moet blijven werken en daarna synchroniseren.
2. Noteer in `CLAUDE.md` en `server/README.md` dat back-up (R-30/R-31) bewust ontbreekt, en dat de
   JSON-export en de lokale IndexedDB-kopieën de enige reservekopieën zijn.
3. PR met: wat gedraaid is, afwijkingen, bekende beperkingen.

## Risico's

- **Geen persistente opslag op prod** is het hoofdrisico. Daarom is de testrecord-controle in fase 4 een harde poort.
- **De deploy vervangt de live app.** Als iets misgaat, deploy je de vorige commit
  (`aec95fd` is de laatste spa-versie) opnieuw; de data in de browser blijft hoe dan ook staan.
- **Eén server en geen back-up (bewust uitgesteld).** Verlies van de prod-data betekent terug op
  de lokale kopieën in de browsers. Dat is acceptabel zolang je ingelogd blijft op minstens één
  apparaat; maak af en toe een JSON-export.
- **Migratie/dubbele data** bij de eerste sync (defaults, settings-singleton). Mitigatie: export
  vooraf, fase 2 vóór fase 4, tellingen in R-20/R-23.
- **Last-write-wins** kan bij gelijktijdig offline bewerken een wijziging verliezen. Geaccepteerd.
- **Tokens in `localStorage`** (PocketBase-sessie, Claude-key) zijn leesbaar voor scripts op de origin.
  Voeg geen scripts van derden toe.
