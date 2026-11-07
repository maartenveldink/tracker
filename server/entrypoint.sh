#!/bin/sh
# Container entrypoint: PocketBase serving both the API and the built PWA.
#
#   PORT                listen port (prod sets 8080)
#   PB_DATA_DIR         data dir (SQLite + uploads); MUST be on persistent storage
#   PB_ADMIN_EMAIL /
#   PB_ADMIN_PASSWORD   if both are set, the superuser is created/updated on start
#   TRACKER_ALLOW_SIGNUP=true  allows registration beyond the first account
set -eu

DATA_DIR="${PB_DATA_DIR:-/data}"
PORT="${PORT:-8080}"

mkdir -p "$DATA_DIR"

if [ -n "${PB_ADMIN_EMAIL:-}" ] && [ -n "${PB_ADMIN_PASSWORD:-}" ]; then
  /usr/local/bin/pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" \
    --dir="$DATA_DIR" --migrationsDir=/pb_migrations >/dev/null
fi

exec /usr/local/bin/pocketbase serve \
  --http="0.0.0.0:${PORT}" \
  --dir="$DATA_DIR" \
  --publicDir=/pb_public \
  --migrationsDir=/pb_migrations \
  --hooksDir=/pb_hooks
