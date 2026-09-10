# Tracker backend (PocketBase)

Self-hosted backend for multi-user accounts + cross-device sync. See the full
design in [`../docs/design.multi-user-sync.md`](../docs/design.multi-user-sync.md).

The client stays offline-first (Dexie/IndexedDB is the source during use); this
backend only provides auth, storage and per-user isolation. The sync engine
lives in the client (`src/lib/sync/`).

## What's here

- `docker-compose.yml` — pinned PocketBase + Caddy containers, `pb_data` volume
  and `caddy_data`/`caddy_config` volumes for cert persistence.
- `Caddyfile` — the production reverse proxy: automatic HTTPS (Let's Encrypt),
  proxies `/api/*` and `/_/*` to PocketBase, serves the built PWA (SPA) for the
  rest. Domain is configurable via `TRACKER_DOMAIN`.
- `deploy.sh` — idempotent deploy script (pull + up + health-wait + admin
  bootstrap). Run `bash deploy.sh` (or `chmod +x deploy.sh` once, then
  `./deploy.sh`).
- `pb_migrations/` — the collection schema as code (auto-applied on start,
  committed to git → reproducible; requirement A-08).
- `.env.example` — configuration template.

## Deployment (Caddy-fronted, single public entry point)

On a VPS with Docker + Docker Compose. **Caddy is the only public entry point**
(ports 80/443); PocketBase is not published to the host — Caddy reaches it over
the internal compose network at `pocketbase:8090`.

```bash
cd server
cp .env.example .env          # edit the values, incl. TRACKER_DOMAIN
bash deploy.sh                # pulls images, starts the stack, waits for health,
                              # and creates the admin (superuser) from .env
```

`deploy.sh` is idempotent — re-run it to pull new images or re-apply. It creates
the admin via `superuser upsert` (requirement A-09), so no UI step is needed.

Before the first deploy: point `TRACKER_DOMAIN`'s DNS A/AAAA record at the VPS
and open ports 80 + 443 so Let's Encrypt can issue the certificate.

Admin UI: `https://<TRACKER_DOMAIN>/_/` · API: `https://<TRACKER_DOMAIN>/api/`

### Where to put the PWA build

Caddy serves the static PWA from `server/dist/` (bind-mounted read-only into the
container at `/srv/tracker`, with SPA fallback to `index.html`). After building
the client at the repo root:

```bash
npm run build                 # in the project root → produces dist/
cp -r ../dist server/dist     # (or symlink) so Caddy can serve it
```

Point the client at the backend with `VITE_PB_URL=https://<TRACKER_DOMAIN>`
before building, so it uses the same origin as the served site.

### Local testing without a domain

Set `TRACKER_DOMAIN=localhost` in `.env`; Caddy then serves a self-signed cert
(no Let's Encrypt) on `https://localhost`.

### Manual equivalent

```bash
docker compose up -d          # starts PocketBase + Caddy; migrations apply automatically
docker compose exec pocketbase \
  /usr/local/bin/pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD"
```

## Auth model (no SMTP)

The built-in `users` collection is configured for **username + password** login
(no e-mail required, verification disabled) so no mail server is needed. Google
OAuth can be added later in the admin UI (Collections → users → OAuth2) without
schema changes. There is no e-mail password reset (no SMTP); reset via the admin.

## Collections

`exercises`, `schemas`, `workouts`, `body_weights`, `habits`, `habit_logs`,
`settings` — each stores the whole client document in a `data` JSON field plus
`clientUpdatedAt` (last-write-wins), `deleted` (tombstone) and a `user` relation.
Every collection's API rules are `@request.auth.id != '' && user = @request.auth.id`,
giving per-user isolation (requirements E-01/E-02, H-02).

## Changing the schema later

1. Make the change in the admin UI locally (PocketBase runs with `--automigrate`
   by default, so it writes a new file to `pb_migrations/`).
2. Commit the generated migration.
3. Deploy the new image → the migration applies automatically on start.

## Frontend config

Point the client at this backend with a build-time env var (see the root
project): `VITE_PB_URL=https://<TRACKER_DOMAIN>`. Since Caddy serves both the
PWA and the API from the same origin, this is just your domain.
