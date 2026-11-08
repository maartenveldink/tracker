# Tracker backend (PocketBase, single container)

One container serves **both** the API and the built PWA, on one origin. Design:
[`../docs/design.multi-user-sync.md`](../docs/design.multi-user-sync.md); requirements and
plan: `../docs/requirements.server-persistence.md`, `../docs/plan.server-persistence.md`.

The client stays offline-first (IndexedDB is the source during use); this backend
only provides auth, storage and per-user isolation. The sync engine is in `src/lib/sync/`.

## Files

- `../Dockerfile`: stage 1 builds the PWA (`VITE_PB_URL=same-origin`), stage 2 is
  PocketBase 0.28.4 (pinned) with the PWA in `/pb_public`.
- `entrypoint.sh`: creates the superuser from env, then `pocketbase serve` on `$PORT`.
- `pb_migrations/`: the collection schema as code (auto-applied on start).
- `pb_hooks/signup.pb.js`: closed sign-up (first account only).

## Configuration (environment)

| Variable | Meaning |
|---|---|
| `PORT` | Listen port. Default 8080 (what `prod-cli` expects). |
| `PB_DATA_DIR` | Data dir (SQLite + uploads). Default `/data`. **Must be persistent.** |
| `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD` | If both are set, the superuser is created/updated on every start. Set them in the beheerpagina (never in git). |
| `TRACKER_ALLOW_SIGNUP` | `true` allows registration beyond the first account. Default: closed. |

## Persistence (important)

Everything lives in `PB_DATA_DIR` (`/data`). On the server the container root is read-only and
only `/data` and `/tmp` are writable. `/data` is a bind mount of `~/data/tracker` on the host, and
the platform **only creates that mount when the project contains a `data/` directory**
(`lib/runtime/podman.sh` in release-scripting). That is why the repo has `data/.gitkeep`: do
not delete it, or the next deploy has no persistent `/data` and PocketBase crashes on start.
The host directory outlives deploys; its contents are never replaced by the repo.

Before putting real data on it, verify persistence once: create a record in the admin UI,
redeploy, check the record is still there.

There is **no automated backup**. The reserve copies are the JSON export in the app
(Instellingen) and the local IndexedDB copy on each signed-in device.

## First start

1. Deploy (see "Deploy (productie)" in `../CLAUDE.md`).
2. Open `https://<app-domain>/`, register your account (username + password). That is
   the only account that can register itself; sign-up is closed afterwards.
3. Admin UI: `https://<app-domain>/_/` (superuser from the env above).

## Local test

```bash
docker build -t tracker-pb .
docker run --rm -p 8080:8080 -v "$PWD/.pbdata:/data" \
  -e PB_ADMIN_EMAIL=admin@example.com -e PB_ADMIN_PASSWORD=change-me-please tracker-pb
```

## Collections

`exercises`, `schemas`, `workouts`, `body_weights`, `habits`, `habit_logs`, `settings`:
each stores the whole client document in a `data` JSON field plus `clientUpdatedAt`
(last-write-wins), `deleted` (tombstone) and a `user` relation. API rules on every
collection: `@request.auth.id != '' && user = @request.auth.id`.

## Changing the schema later

Run PocketBase locally with `--automigrate`, change the collection in the admin UI, commit the
generated file in `pb_migrations/`, redeploy. Migrations apply on start.
