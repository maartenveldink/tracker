# Requirements — Data op de server persisteren (alles op de ene prod-server)

## Doel

Mijn trainingsdata (oefeningen, schema's, workouts, lichaamsgewicht, habits,
instellingen) staat naast IndexedDB ook op de server. Gevolgen: data overleeft het
wissen van de browser of een nieuwe telefoon, en meerdere apparaten tonen dezelfde
data. De app blijft offline-first.

## Randvoorwaarde

Er is **één productieserver**, bediend met `prod-cli`. Alles draait daar: de PWA
én de backend met de data. Er komt geen aparte VPS. De app blijft op
`https://tracker.app.maartenveldink.nl/` (één origin: geen CORS, geen tweede domein).

## Uitgangspositie (uit de repo gelezen, nog niet end-to-end gedraaid)

Dit is geen nieuwbouw. Er bestaan al:

- Ontwerp en requirements: `docs/design.multi-user-sync.md` (epics A–H, N).
  Dat blijft de bron voor het datamodel en de sync-regels.
- Client: `src/lib/pb.ts`, `src/lib/sync/`, `src/features/auth/`, Dexie v17–v20
  (string-ids, `dirty`/`deleted`/`clientUpdatedAt`).
- Server: `server/` met PocketBase 0.28.4 (docker-compose + Caddy) en
  `pb_migrations/`. De client praat PocketBase's API.
- Uitgeschakeld in de live build: `VITE_PB_URL` is niet gezet, dus
  `backendConfigured()` is `false` (geen login, geen sync).
- De live app is nu een `spa` zonder backend. `CLAUDE.md` zegt nog "no backend,
  no auth" en moet bijgewerkt worden.

## Wat `prod-cli` wel en niet kan (relevant voor de keuze)

- Soorten: `static`, `spa`, `python`, `node`. Een project met een eigen
  `Dockerfile` wordt ook ondersteund (`--kind` kiest dan de healthcheck).
  De container moet luisteren op `0.0.0.0:$PORT` (8080).
- Docker-compose, een tweede container (Caddy) of eigen volumes kan niet.
  PocketBase kan dus alleen via een eigen `Dockerfile` op prod draaien, als
  **één container** die ook de PWA serveert (`pb_public`). Caddy en TLS vervallen:
  prod regelt TLS.
- **Onbekend en beslissend:** blijft schijfdata van een app bewaard bij een
  nieuwe deploy en bij een herstart? Zo niet, dan wist elke deploy de database.
  Dit moet vóór alles anders vaststaan (R-00).

## Vastgestelde keuzes

| Onderwerp | Keuze |
|---|---|
| Backend | PocketBase in één container op prod, via een `Dockerfile` in de repo (herbruikt de bestaande client en migraties) |
| PWA | Dezelfde container serveert de gebouwde PWA (`pb_public`), zelfde origin als de API |
| Sync / auth | Bestaande engine en login: offline-first, last-write-wins, gebruikersnaam + wachtwoord, geen SMTP |
| Terugvalroute | Als PocketBase op prod niet kan of niet persistent is: kleine node-app met SQLite op prod (vraagt aanpassing van de client-sync) |

## Besluiten van de gebruiker

| ID | Besluit |
|---|---|
| O-1 | De gebruiker beheert de prod-server zelf. Uitrollen moet vanaf de DevBox kunnen met `prod-cli` / de `prod`-MCP (geen handmatige serverstappen voor een gewone deploy). |
| O-2 | Geen wegwerp-app op prod. Docker-build en PocketBase worden getest op de DevBox (MCP `release-scripting`); persistentie op prod wordt bewezen op de echte `tracker`-app met een testrecord, vóór er echte data heen gaat (R-00). |
| O-3 | Back-up is nu niet relevant en valt buiten scope (R-30/R-31 uitgesteld). De JSON-export uit de app blijft bestaan. |
| O-4 | Voorlopig één gebruiker. Registratie gaat dicht zodra mijn account bestaat; andere gebruikers kunnen later (accounts aanmaken via de admin-UI). |

## Open punt dat de gebruiker moet beantwoorden

| ID | Vraag | Waarom |
|---|---|---|
| O-5 | Hoe geef je een app op prod een persistente schijf (volume / mount / pad), en kan dat met een instelling op de beheerpagina of alleen op de server zelf? | De DevBox bewijst alleen dat de container werkt, niet dat prod de data bewaart. Zonder persistentie wist elke deploy de database. |

## Requirements

Hergebruik ID's uit `docs/design.multi-user-sync.md` waar ze bestaan; hier staan de
aanvullingen en extra acceptatiecriteria voor deze opzet.

### Voorwaarde: persistentie (blokkeert alles)

| ID | Requirement | Acceptatiecriteria |
|---|---|---|
| R-00 | Data in de pb_data-map overleeft een nieuwe deploy én een herstart van de container, op **prod** (niet alleen op de DevBox) | Op de echte `tracker`-app: testrecord aanmaken in PocketBase, opnieuw uitrollen met `prod-cli deploy`, record is er nog. Vastgelegd in `docs/` met de gebruikte opslagplek. Pas daarna mag er echte data heen |

### Server en hosting

| ID | Requirement | Acceptatiecriteria |
|---|---|---|
| R-01 | PocketBase draait als app `tracker` op prod, in één container via `Dockerfile` | `prod-cli deploy` wordt `live`; `https://tracker.app.maartenveldink.nl/api/health` geeft 200 |
| R-02 | De container serveert ook de PWA | `https://tracker.app.maartenveldink.nl/` toont de app; SPA-routes (bijv. `/schemas`) laden bij verversen (fallback naar `index.html`) |
| R-03 | Collecties komen uit `server/pb_migrations/` (in het image) | Een verse, lege data-map bouwt alle 7 collecties + users op bij eerste start |
| R-04 | De admin-UI is afgeschermd | `/_/` vraagt login. Het admin-wachtwoord is sterk en komt niet in git of image; het wordt via env/secret gezet (`app_env` laat namen zien, de waarden zet een mens) |
| R-05 | Geen secrets in git, image of frontend-bundle | `grep` in repo, `dist/` en de Dockerfile vindt geen wachtwoorden of encryptiesleutel |
| R-06 | PocketBase is gepind (0.28.4) en luistert op `0.0.0.0:$PORT` | Dockerfile gebruikt een vaste versie; `serve --http=0.0.0.0:8080` |
| R-07 | De PWA wordt in de build gemaakt met de juiste backend-URL | `VITE_PB_URL=https://tracker.app.maartenveldink.nl` staat in de gebouwde bundel; de build gebeurt in de Dockerfile (multi-stage) of, als dat niet kan, uit een gecommitte `dist/` zoals nu |

### Client activeren

| ID | Requirement | Acceptatiecriteria |
|---|---|---|
| R-10 | Eerste bezoek toont het loginscherm; daarna werkt de app offline | Loginscherm bij schone browser; na inloggen en uitzetten van netwerk blijft alles werken |
| R-12 | De service worker cachet geen API-calls | `navigateFallbackDenylist` blijft; in DevTools komt `/api/*` nooit uit de SW-cache |
| R-13 | `tracker.coach.*` en `tracker.deload.*` synchroniseren niet | Na sync staat de Claude-key niet in PocketBase |
| R-14 | Open registratie staat uit nadat mijn account bestaat (alleen ik, voorlopig) | Registreren met een nieuwe naam geeft een fout; bestaande login werkt. Nieuwe gebruikers kunnen later via de admin-UI worden aangemaakt |

### Migratie van bestaande data

| ID | Requirement | Acceptatiecriteria |
|---|---|---|
| R-20 | Mijn huidige lokale data gaat verliesvrij naar de server | Aantallen per tabel vóór en na de eerste sync gelijk, lokaal en in PocketBase |
| R-21 | Er is een JSON-export vóór de eerste sync | Export uit Instellingen opgeslagen buiten de browser |
| R-22 | Een tweede apparaat toont na inloggen dezelfde data | Nieuw browserprofiel, inloggen, na één sync-cyclus gelijke aantallen |
| R-23 | De eerste sync verdubbelt geen default-oefeningen | Aantal defaults blijft 25 op beide apparaten |

### Betrouwbaarheid en back-up

| ID | Requirement | Acceptatiecriteria |
|---|---|---|
| R-30 | _Uitgesteld (O-3):_ back-up buiten de prod-server | Nu alleen: de JSON-export uit de app en de lokale kopie in IndexedDB op elk ingelogd apparaat |
| R-31 | _Uitgesteld (O-3):_ aangetoonde restore | — |
| R-32 | De app werkt door als de server onbereikbaar is | Server stoppen/deployen: workout loggen lukt, syncstatus toont offline; daarna loopt de achterstand in |
| R-33 | Een nieuwe deploy raakt de data niet | Na een herdeploy zijn alle records er nog (zelfde test als R-00, op de echte app) |

### Documentatie en kwaliteit

| ID | Requirement | Acceptatiecriteria |
|---|---|---|
| R-40 | `CLAUDE.md` beschrijft de huidige architectuur (backend, auth, sync, `VITE_PB_URL`, deploy van één container) | Geen "no backend/no auth" meer zonder uitleg |
| R-41 | De sectie "Deploy (productie)" in `CLAUDE.md` volgt de nieuwe deployroute | Vermeldt Dockerfile, env/secrets, persistentieplek en de back-upprocedure |
| R-42 | Minimaal één e2e-scenario voor sync (gemockt of tegen lokale PocketBase) | `npm run e2e` slaagt; scenario: login, push van een workout, pull op tweede context |
| R-43 | `npx tsc --noEmit` en `npm run build` zijn schoon | Beide exit 0 |
| R-44 | `server/` is opgeschoond voor de nieuwe opzet | Caddy-bestanden en docker-compose zijn verwijderd of als "niet gebruikt op prod" gemarkeerd; README klopt |

## Buiten scope

- Delen van schema's of data tussen gebruikers (blijft via QR/link).
- Realtime-sync (periodiek + na mutatie is genoeg).
- Google-login.
- Een tweede server of VPS.
- Veldniveau-merge; last-write-wins per record blijft een bekende beperking.
