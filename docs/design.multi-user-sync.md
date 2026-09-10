# Ontwerp & Requirements — Multi-user met accounts en sync (Optie C)

## Context

Tracker is nu een **single-user, offline-first PWA** zonder backend: alle data
staat lokaal in IndexedDB (Dexie, DB-versie 16). Er is geen enkel besef van
"gebruikers" — `AppSettings` is een singleton-rij (`id: 1`), en alle
primaire sleutels zijn device-lokale auto-increment integers (`++id`).

Er komt een tweede gebruiker bij. De gekozen richting (Optie C) is een
**echte multi-user app**: iedere gebruiker heeft een eigen account, en zijn data
synct over meerdere apparaten via een zelf-gehoste backend. Dit is bewust een
**architectuurwijziging**, niet een feature erbij: `CLAUDE.md` beschrijft de app
expliciet als "offline-first, no backend, single-user, no auth". Dat blijft
gedeeltelijk gelden — de app blijft offline-first — maar er komt een backend en
auth bij.

Dit document beschrijft het ontwerp en de requirements zodat je kunt beoordelen
of je deze implementatie wil, vóórdat er code geschreven wordt.

### Vastgestelde keuzes (met jou afgestemd)

| Onderwerp | Keuze |
|---|---|
| Backend | **PocketBase**, self-hosted op VPS met Docker (één container) |
| Sync-model | Offline-first + achtergrond-sync, **last-write-wins per record** |
| Deel-scope | Alleen privé + sync; schema's delen blijft via bestaande QR/link |
| Auth | Gebruikersnaam/wachtwoord **én** optioneel Google OAuth; **geen SMTP** (geen e-mailverificatie/-reset) |

---

## Waarom PocketBase

We begonnen met een eigen backend (Fastify + Postgres), maar PocketBase past
beter bij deze schaal (twee gebruikers) en bij je randvoorwaarden (VPS + Docker,
geen SMTP). Het is **één Go-binary** die auth, database, API-regels (per-user
isolatie), een admin-UI en realtime out-of-the-box levert. Dat scheelt het gros
van de zelf-te-bouwen serverkant.

Belangrijk voor jouw situatie (geverifieerd in de PocketBase-docs):
- Het login-identiteitsveld is standaard `email`, maar mag **`username`** zijn.
- **Password-signup en -login vereisen geen SMTP.** SMTP heb je alleen nodig voor
  e-mailverificatie, wachtwoord-reset-mails en OTP — die laten we uit.
- E-mailverificatie is **niet verplicht** om een account te gebruiken.
- Google OAuth2 is optioneel en kan náást username/password in dezelfde
  auth-collectie bestaan.

### Alternatieven (ter kennisname)

| Optie | Wat het is | Waarom niet (nu) |
|---|---|---|
| **PocketBase** (gekozen) | Één Go-binary: SQLite + auth + API-rules + realtime + admin-UI | — |
| **Eigen backend** (Fastify + Postgres) | Zelf API + DB + auth bouwen | Veruit het meeste bouw- en onderhoudswerk voor deze schaal |
| **Supabase** | Open-source BaaS: Postgres + Auth + RLS | Meer bewegende delen; zwaarder dan nodig |
| **Appwrite** | Open-source BaaS, Docker-first | Zwaarder qua VPS-resources |
| **Firebase** | Google BaaS (Firestore) | Niet self-hostbaar; NoSQL past minder op relationele data |
| **Dexie Cloud** | Sync-dienst voor Dexie | Betaalde hosted dienst; niet self-hostbaar |

> Kanttekening: PocketBase gebruikt **SQLite** (één bestand). Voor twee
> gebruikers is dat juist een voordeel (simpel, snel, makkelijk te back-uppen);
> pas bij forse groei/veel gelijktijdige schrijvers zou een eigen Postgres beter
> schalen.

---

## Ontwerp

### Architectuur in één plaatje

```
  [ Browser / PWA ]                         [ VPS (Docker) ]
  React 19 + Dexie(IndexedDB)   HTTPS   ┌──────────────────────────────┐
        │  (bron tijdens gebruik)  ───► │  PocketBase (1 container)     │
        │                               │   - Auth (username/pw + OAuth)│
        │  Sync-engine (push/pull)      │   - Collections + API-rules   │
        │  via PocketBase JS SDK        │   - SQLite (bestand + volume) │
        │                               │   - Realtime (optioneel)      │
        └──────────────────────────────┼──► - Serveert evt. de PWA      │
                                        │       (pb_public) + auto-TLS  │
                                        └──────────────────────────────┘
```

De PWA blijft **offline-first**: IndexedDB is de bron tijdens gebruik; de
sync-engine praat op de achtergrond met PocketBase. Zonder bereik werkt alles
door en synct later.

### Wat PocketBase levert vs. wat we zelf bouwen

| Onderdeel | PocketBase (ingebouwd) | Zelf bouwen |
|---|---|---|
| Auth (username/pw + Google) | ✅ Auth-collectie configureren | Login/registratie-UI in de app |
| Database + admin | ✅ SQLite + web-admin | Collectie-definities aanmaken |
| Per-user data-isolatie | ✅ API-rules (`@request.auth.id = user`) | De rules instellen |
| REST + realtime API | ✅ Auto-gegenereerd | — |
| **Offline sync** | ❌ (niet ingebouwd) | **Client-side sync-engine** |
| UUID-migratie bestaande data | ❌ | **Dexie v17-migratie** |

Het echte werk zit dus in de **client**: de UUID-ombouw en de sync-engine.
PocketBase neemt vrijwel de hele serverkant weg.

### Techniekkeuze

- **Backend:** PocketBase (laatste stabiele versie) als Docker-container, met een
  named volume voor `pb_data` (SQLite + uploads). Automatische HTTPS via de
  ingebouwde Let's Encrypt-optie, óf achter Caddy als je al een proxy draait.
- **Client-SDK:** de officiële `pocketbase` JS-SDK (auth-token-beheer,
  record-CRUD, realtime).
- **Frontend:** ongewijzigd qua stack (React 19 + Vite + Dexie). Kan als statische
  build in PocketBase's `pb_public` worden geserveerd, of apart blijven hosten.

### Kern van de wijziging: globale IDs + sync-metadata (client)

Het grootste knelpunt is dat alle tabellen nu **device-lokale auto-increment
integers** gebruiken (`++id`). Die botsen tussen apparaten en zijn onbruikbaar
voor sync. Oplossing:

1. **Alle entiteiten krijgen client-gegenereerde string-IDs** (UUID, of het
   15-tekens PocketBase-formaat). Lokale id == PocketBase record-id, wat sync
   sterk vereenvoudigt.
2. **Standaard-oefeningen (`isDefault`) krijgen deterministische, vaste IDs**
   (hardcoded in de seed). Zo seedt elk apparaat exact dezelfde ids, blijven
   synced schema's/workouts die ernaar verwijzen valide, en hoeven de 25
   defaults **niet** per user gesynct te worden. (De export filtert defaults nu
   al weg — zelfde principe.)
3. Elke synchroniseerbare rij krijgt sync-velden:
   - `clientUpdatedAt: number` — epoch ms, gezet bij elke lokale schrijf (basis
     voor last-write-wins).
   - `deleted: boolean` — **tombstone** i.p.v. harde delete, zodat verwijderingen
     ook syncen.
   - `dirty: 0 | 1` — lokaal gewijzigd sinds laatste succesvolle push.

Foreign keys die vandaag numeriek zijn (`schema.exercises[].exerciseId`,
`workout.exercises[].exerciseId`, `habitLog.habitId`, `workout.schemaId`) worden
string-IDs. De bestaande **ID-remap-logica in `importData.ts` is het
referentievoorbeeld** voor de eenmalige migratie.

### Sync-engine (client)

Offline-first push/pull tegen de PocketBase records-API (via de JS-SDK):

- **Cursor:** client bewaart `lastSyncedAt` (PocketBase's server-side `updated`
  van de laatste gesynchroniseerde record).
- **Push:** voor elke `dirty = 1`-rij een `create` of `update` op de juiste
  collectie; de `user`-relatie wordt gezet op de ingelogde user.
- **Pull:** per collectie `getFullList` met filter `updated > "{lastSyncedAt}"`.
- **Conflict:** **last-write-wins** op `clientUpdatedAt`. Bij pull wint de rij met
  de hoogste `clientUpdatedAt`; lokaal toegepaste pull-rijen worden **niet** dirty
  gemarkeerd, succesvol gepushte rijen worden dirty-gecleared. Optioneel een
  PocketBase-hook (`pb_hooks`) die een push met oudere `clientUpdatedAt` weigert,
  om ook server-side stale writes te blokkeren.
- **Triggers:** bij app-start, bij terugkeer van connectiviteit (`online`-event),
  debounced na mutaties, en periodiek. Optioneel PocketBase **realtime
  subscriptions** voor near-live updates i.p.v. periodiek pollen.
- **Granulariteit:** whole-record LWW. Voor `workouts` (genest document) betekent
  dit dat gelijktijdig bewerken van dezelfde workout op twee apparaten de oudste
  versie kan overschrijven — zie *Bekende beperkingen*.

### Server-datamodel (PocketBase-collecties)

Eén auth-collectie + één base-collectie per entiteit. De flexibele geneste
structuren gaan in een **`data` JSON-veld** (matcht de Dexie-documenten 1-op-1 →
whole-record LWW blijft simpel). PocketBase beheert `id`, `created` en `updated`
automatisch.

| Collectie | Type | Belangrijkste velden |
|---|---|---|
| `users` | auth | `username` (identity, uniek), `email` (optioneel), `password`, `name` |
| `exercises` | base | `user` (relation→users), `data` (json), `clientUpdatedAt` (number), `deleted` (bool) |
| `schemas` | base | idem (`data` bevat `days`/`exercises`/`rotation`) |
| `workouts` | base | idem (`data` bevat geneste `exercises`/`sets`) |
| `body_weights` | base | idem |
| `habits` | base | idem |
| `habit_logs` | base | idem |
| `settings` | base | `user` (uniek), `data` (json), `clientUpdatedAt`, `deleted` (één rij per user) |

**Per-user isolatie** via API-rules op elke base-collectie (list/view/create/
update/delete): `@request.auth.id = user`. Dit is de PocketBase-tegenhanger van
row-level security en levert data-isolatie vrijwel gratis.

### Auth-flow

PocketBase's auth-collectie levert de sessie (auth-token, door de SDK beheerd).
Twee methodes, naast elkaar in dezelfde collectie:

**Gebruikersnaam + wachtwoord (geen SMTP):**
1. Registreren: `pb.collection('users').create({ username, password, passwordConfirm })`.
   Geen e-mail vereist, geen verificatiemail (verificatie staat uit).
2. Inloggen: `pb.collection('users').authWithPassword(username, password)`.
3. Er is **geen** wachtwoord-reset via e-mail (geen SMTP). Reset kan later
   eventueel handmatig via de PocketBase-admin.

**Google OAuth (optioneel):**
1. Google als OAuth2-provider aanzetten in de PocketBase-admin.
2. Inloggen: `pb.collection('users').authWithOAuth2({ provider: 'google' })`.

Configuratie in PocketBase: identity-veld op `username`, e-mail optioneel,
e-mailverificatie niet verplicht.

### Offline-gedrag & auth (de app werkt door als de backend plat ligt)

De app is offline-first: eenmaal ingelogd op een apparaat blijft **alles** werken
zonder backend (workouts loggen, bewerken, historie/voortgang bekijken). Alleen
**sync** pauzeert; wijzigingen blijven `dirty` en lopen bij zodra de backend terug
is. Slechts twee dingen vereisen de backend online:

1. **De allereerste login op een apparaat** — daarna is de auth-token lokaal
   gecached en werkt alles offline.
2. **Een verlopen token verversen** — kan alleen weer online.

Belangrijk ontwerpprincipe: **de UI mag niet gegate worden op een live
backend-check of een geldig token.** Concreet:
- Was er ooit een sessie op dit apparaat → toon de app + lokale data.
- Alleen sync wordt geblokkeerd bij geen/verlopen token; de token wordt
  opportunistisch ververst zodra er weer verbinding is.
- Nooit automatisch "hard uitloggen" (lokale cache wissen) puur omdat een token
  verliep tijdens offline gebruik; alleen expliciet uitloggen wist lokale data.

Het loginscherm (G-01) geldt dus alleen bij "nooit eerder ingelogd op dit
apparaat", niet bij een toevallig verlopen token.

### Migratie van jouw bestaande lokale data

Nieuwe Dexie-versie (v17) draait eenmalig op jouw apparaat:

1. Genereer string-IDs voor alle bestaande rijen; bouw een oud-int → nieuw-id map.
2. Herschrijf alle FKs met die map (hergebruik het patroon uit `importData.ts`).
3. Ken default-oefeningen hun **deterministische** IDs toe (op naam gematcht).
4. Zet op alle rijen `clientUpdatedAt = nu`, `dirty = 1`, `deleted = false`.
5. Bij eerste login+sync pusht dit alles naar PocketBase onder jouw account.

De nieuwe gebruiker start schoon: seed defaults (vaste IDs), lege user-data.

### Deployment op de VPS (Docker)

- `docker-compose.yml` met de `pocketbase`-container + named volume voor
  `pb_data`. TLS via PocketBase's ingebouwde Let's Encrypt, of achter een
  bestaande Caddy/Traefik.
- Frontend: statisch bouwen en in `pb_public` plaatsen (dan serveert PocketBase
  zowel API als PWA), óf apart hosten met `VITE_API_URL` naar PocketBase.
- Backups: `pb_data` is één map — periodieke kopie/volume-snapshot volstaat.

### Infrastructure as Code & migraties

Alles is reproduceerbaar en versiebeheerd; er zijn **twee migratielagen** (server
en client), plus de infra-laag.

**Infra-laag (de container):**
- `docker-compose.yml` in de repo is de bron van waarheid (image-versie gepind,
  `pb_data`-volume, poorten, TLS-flags).
- Optioneel Terraform (VPS provisioning) en/of Ansible (image pullen + `compose up`).
- Config/secrets via env-vars; de eerste admin non-interactief via
  `pocketbase superuser upsert <email> <pass>` (scriptbaar in de deploy).

**Server-schema-laag (PocketBase-collecties) — `pb_migrations/`:**
- Collectie-definities leven als **JS-migratiebestanden** met `up`/`down`, in git.
- Draaien **automatisch** bij `serve`/`migrate up`, elk binnen een transactie.
- **`--automigrate` (standaard aan)** schrijft elke admin-UI-wijziging automatisch
  als migratiebestand weg — geen handwerk.
- `migrate collections` maakt een volledige snapshot als baseline;
  `migrate history-sync` ruimt de migratie-tabel op na het weggooien van
  test-migraties.
- **Workflow voor een latere wijziging:** lokaal in admin-UI aanpassen →
  automigrate schrijft een bestand → committen → nieuwe image deployen → migratie
  draait automatisch bij start.

**Client-schema-laag (IndexedDB) — Dexie-versies:**
- Blijft de bestaande, aparte Dexie-versiemigratie (v17 e.v.) voor het lokale
  schema. Staat los van de serverkant — inherent aan offline-first.

### Bekende beperkingen (bewust geaccepteerd bij deze scope)

- **LWW is grofmazig:** gelijktijdige edits op twee apparaten kunnen elkaar
  overschrijven (met name een actieve workout die op twee toestellen loopt). Voor
  een single-user-per-account fitness-app is dat zeldzaam en acceptabel.
- **SQLite:** prima voor deze schaal; niet bedoeld voor veel gelijktijdige
  schrijvers.
- **Geen wachtwoord-reset via e-mail** (geen SMTP) — bewust; reset via admin.
- **Geen delen tussen users** (bewust buiten scope): schema's delen blijft via de
  bestaande QR/link (`schemaShare.ts`).

---

## Requirements

Functionele requirements per epic, met acceptatiecriteria in tabelvorm (geen user
stories).

### Epic A — PocketBase-fundament & deployment

| ID | Requirement | Acceptatiecriteria |
|---|---|---|
| A-01 | PocketBase draait als Docker-container op de VPS | Container start; admin-UI en API bereikbaar |
| A-02 | `pb_data` op een persistent named volume | Data overleeft container-herstart |
| A-03 | Alle collecties + velden zijn gedefinieerd | Collecties `users` + 7 base-collecties bestaan met de juiste velden |
| A-04 | HTTPS actief (ingebouwd of via proxy) | API + PWA bereikbaar over HTTPS met geldig certificaat |
| A-05 | Configuratie via env-vars/instellingen | Geen secrets in de frontend; admin-credential veilig |
| A-06 | `docker-compose up` brengt alles online | Eén commando start PocketBase (+ evt. proxy) |
| A-07 | Infra is als code in de repo | `docker-compose.yml` (image-versie gepind) + optioneel Terraform/Ansible; geen handmatige VPS-stappen buiten versiebeheer |
| A-08 | Collectie-wijzigingen als migratie in git | Elke schema-wijziging levert een `pb_migrations`-bestand op (via `--automigrate`), gecommit; draait automatisch bij deploy |
| A-09 | Eerste admin scriptbaar aanmaken | Superuser via `superuser upsert` (env/CLI), niet handmatig via UI vereist |

### Epic B — Authenticatie (username/wachtwoord + optioneel Google)

| ID | Requirement | Acceptatiecriteria |
|---|---|---|
| B-01 | `users`-collectie gebruikt `username` als identiteit | Inloggen kan op gebruikersnaam; e-mail niet vereist |
| B-02 | Registreren met gebruikersnaam + wachtwoord | `create` maakt een user aan; direct bruikbaar, geen verificatiemail |
| B-03 | Geen SMTP nodig | Signup/login werken zonder mailserver; verificatie/reset staan uit |
| B-04 | Wachtwoorden veilig opgeslagen | PocketBase hasht wachtwoorden; nooit plaintext |
| B-05 | Dubbele gebruikersnaam wordt geweigerd | Registreren met bestaande naam → duidelijke fout |
| B-06 | Inloggen met gebruikersnaam + wachtwoord | Correcte combinatie → sessie; foute combinatie → fout |
| B-07 | Optioneel inloggen met Google | Indien aangezet levert `authWithOAuth2` een geldige sessie |
| B-08 | Sessie/auth-token door de SDK beheerd | Token bewaard; automatisch meegestuurd bij API-calls |
| B-09 | Gebruiker kan uitloggen | Logout wist de auth-store; API-calls daarna niet geautoriseerd |

### Epic C — Datamodel: globale IDs + sync-metadata (client)

| ID | Requirement | Acceptatiecriteria |
|---|---|---|
| C-01 | Alle entiteiten gebruiken string-IDs | Nieuwe records krijgen een client-gegenereerde id; geen `++id` meer |
| C-02 | Default-oefeningen hebben vaste, deterministische IDs | Twee schone installs seeden identieke default-ids |
| C-03 | Elke rij heeft `clientUpdatedAt`, `deleted`, `dirty` | Elke lokale schrijf zet `clientUpdatedAt` + `dirty=1` |
| C-04 | Verwijderen is een tombstone, geen harde delete | Delete zet `deleted=true`; record verdwijnt uit de UI-queries |
| C-05 | Alle FKs zijn string-IDs | Schemas/workouts/habitLogs verwijzen correct na de ombouw |
| C-06 | Bestaande hooks/queries blijven werken | Alle lees-hooks negeren `deleted=true`-rijen |

### Epic D — Sync-engine (client)

| ID | Requirement | Acceptatiecriteria |
|---|---|---|
| D-01 | Push stuurt dirty-rijen naar PocketBase | `create`/`update` per collectie; na succes `dirty=0` |
| D-02 | Pull haalt records met `updated > lastSyncedAt` | Nieuwe/gewijzigde serverrijen verschijnen lokaal |
| D-03 | Conflicten via last-write-wins op `clientUpdatedAt` | Nieuwste versie wint; test met bewust conflict |
| D-04 | Tombstones syncen beide kanten op | Delete op apparaat 1 verwijdert het item op apparaat 2 |
| D-05 | Sync triggert bij start, online-event, na mutatie (debounced) en periodiek/realtime | Wijziging op A verschijnt op B binnen één sync-cyclus |
| D-06 | Sync faalt gracieus offline | Geen crash/dataverlies zonder net; hervat bij verbinding |
| D-07 | Sync-status is zichtbaar | UI toont "gesynct / bezig / offline / fout" |
| D-08 | Verlopen token blokkeert alleen sync, niet de app | Bij verlopen token blijft de app + lokale data bruikbaar; token wordt opportunistisch ververst zodra online |

### Epic E — PocketBase-configuratie (server)

| ID | Requirement | Acceptatiecriteria |
|---|---|---|
| E-01 | API-rules scopen elke collectie op de user | Rules `@request.auth.id = user` op list/view/create/update/delete |
| E-02 | User A ziet nooit data van user B | Geverifieerd met twee accounts |
| E-03 | Geneste structuren in JSON-veld | Round-trip behoudt schema-days/workout-sets exact |
| E-04 | `settings` is uniek per user | Eén settings-record per user afgedwongen |
| E-05 | (Optioneel) LWW-hook weigert stale writes | Push met oudere `clientUpdatedAt` wordt geweigerd |

### Epic F — Migratie van bestaande lokale data

| ID | Requirement | Acceptatiecriteria |
|---|---|---|
| F-01 | Dexie v17-migratie zet int-ids om naar string-ids | Alle bestaande records behouden hun onderlinge relaties |
| F-02 | Alle FKs worden correct geremapt | Geen "orphan" schema-oefeningen of workout-sets na migratie |
| F-03 | Default-oefeningen krijgen deterministische ids | Op naam gematcht; geen dubbele defaults |
| F-04 | Alle gemigreerde rijen worden dirty gemarkeerd | Eerste sync pusht de volledige historie naar PocketBase |
| F-05 | Migratie is verliesvrij | Aantal oefeningen/schema's/workouts/etc. gelijk voor en na |

### Epic G — Account- & multi-device-UX

| ID | Requirement | Acceptatiecriteria |
|---|---|---|
| G-01 | Loginscherm alleen bij nooit-eerder-ingelogd | Zonder ooit een sessie op dit apparaat → login/registratie; een verlopen token gate't de app níét |
| G-02 | App toont de ingelogde gebruiker + uitlogknop | Gebruikersnaam zichtbaar in Settings |
| G-03 | Tweede apparaat toont dezelfde data na login | Inloggen op toestel B toont data van toestel A na sync |
| G-04 | Bij uitloggen blijft lokale cache privé | Na logout is user-data niet zichtbaar zonder herlogin |
| G-05 | Bestaande export/import blijft werken | JSON-export/-import functioneert naast sync |

### Epic H — Beveiliging & privacy

| ID | Requirement | Acceptatiecriteria |
|---|---|---|
| H-01 | Alle verkeer over HTTPS/TLS | HTTP redirect naar HTTPS |
| H-02 | Per-user data-isolatie via API-rules | Handmatige poging tot cross-user toegang faalt |
| H-03 | Admin-toegang afgeschermd | PocketBase-admin achter sterk wachtwoord/afgeschermd pad |
| H-04 | Secrets alleen server-side | Geen secrets in de frontend-bundle |
| H-05 | Backups van `pb_data` ingericht | Aantoonbare restore vanaf een backup |

### Niet-functionele requirements

| ID | Requirement | Acceptatiecriteria |
|---|---|---|
| N-01 | App blijft volledig bruikbaar offline | Volledige workout loggen zonder net; synct daarna |
| N-06 | App werkt door als de backend offline is | Eenmaal ingelogd blijft alle functionaliteit werken bij een platte backend; alleen sync pauzeert en loopt bij zodra hersteld |
| N-02 | Sync van een normale dataset < ~2s op mobiel net | Gemeten met representatieve dataset |
| N-03 | Frontend blijft een installeerbare PWA | Service worker cachet static assets, niet de API-calls |
| N-04 | TypeScript strict, geen `any` (bestaande conventie) | `npx tsc --noEmit` schoon |
| N-05 | Zelf-hostbaar op één VPS met Docker | Eén PocketBase-container binnen de bestaande VPS-resources |

---

## Te wijzigen / nieuw te maken bestanden (indicatief)

**Client — wijzigen:**
- `src/db/index.ts` — string-IDs, sync-velden, v17-migratie (patroon uit `importData.ts`).
- `src/features/training/db/seed.ts` — deterministische IDs voor defaults.
- Alle hooks met writes — `clientUpdatedAt`/`dirty` zetten, tombstone i.p.v.
  delete, `deleted`-filter bij reads: `src/features/training/hooks/useExercises.ts`,
  `useSchemas.ts`, `useWorkout.ts`, `useProgress.ts`, `useBodyWeight.ts`,
  `src/features/habits/hooks/useHabits.ts`, `src/hooks/useSettings.ts`
  (settings wordt per-user i.p.v. singleton).
- `src/lib/importData.ts` / `exportData.ts` — string-ID-compatibel maken.
- `vite.config.ts` — SW-cache voor PocketBase API-calls uitsluiten.

**Client — nieuw:**
- `src/lib/pb.ts` — PocketBase-SDK-client (basis-URL, auth-store).
- `src/lib/sync/` — sync-engine (cursor, push/pull, triggers, status-store).
- `src/features/auth/` — login + registratie-scherm (username/wachtwoord +
  optioneel Google-knop), auth-context, `useAuth`.

**Server — nieuw:**
- `docker-compose.yml` voor PocketBase (+ named volume, evt. proxy).
- Collectie-definities (via admin-UI of een `pb_migrations`/import-JSON in de repo
  zodat de opzet reproduceerbaar is).
- Optioneel `pb_hooks/` voor de LWW-guard.

---

## Verificatie (hoe je aantoont dat het werkt)

1. **Registratie zonder e-mail/SMTP:** maak een account met alleen gebruikersnaam
   + wachtwoord → direct ingelogd, geen mail vereist. (B-02, B-03)
2. **Data-isolatie:** twee accounts in twee browsers; data in A is onzichtbaar in
   B. (H-02, E-02)
3. **Multi-device sync:** account A op browser 1 en 2; workout toevoegen op 1 →
   verschijnt op 2 na een sync-tick. (D-05, G-03)
4. **Offline:** netwerk uit, volledige workout loggen, netwerk aan → data
   verschijnt op het andere apparaat. (N-01, D-06)
5. **Conflict (LWW):** hetzelfde record offline op beide apparaten wijzigen, dan
   online → de laatste schrijf wint, geen crash. (D-03)
6. **Tombstone:** schema verwijderen op apparaat 1 → verdwijnt op apparaat 2. (D-04)
7. **Migratie:** app draaien met je huidige data → v17 migreert; oefeningen/
   schema's/workouts tellen vóór en na (gelijk); eerste sync pusht alles. (F-05)
8. **Type-check:** `npx tsc --noEmit` schoon. (N-04)
9. **E2E:** bestaande Playwright-suite (`npm run e2e`) blijft groen; evt. een
   sync-scenario toevoegen.
10. **Deploy-rooktest:** `docker-compose up` op de VPS → login + sync over HTTPS. (A-06, H-01)
11. **Schema-reproduceerbaarheid:** een verse PocketBase-instance met lege
    `pb_data` + de gecommitte `pb_migrations/` → alle collecties + API-rules
    worden identiek opgebouwd bij eerste start. (A-08)
12. **Backend offline:** log in, stop de PocketBase-container → app + lokale data
    blijven volledig bruikbaar, workouts loggen lukt; start de container → de
    achterstand synct vanzelf bij. (N-06, D-08)

## Belangrijkste risico's

- **Migratie is het echte werk**, niet de UI: het omzetten van int-FKs naar
  string-ids over genest opgeslagen documenten is foutgevoelig — grondig testen op
  een kopie.
- **Sync-engine zelf bouwen:** PocketBase doet geen offline-sync; de push/pull-
  reconciliatie (dirty-tracking, LWW, tombstones) is de grootste nieuwe
  codecomponent.
- **LWW-grofmazigheid** bij gelijktijdig bewerken — geaccepteerd binnen deze scope.
