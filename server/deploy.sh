#!/usr/bin/env bash
#
# Tracker backend deploy — idempotent, safe to re-run.
#
# Brings up the Caddy-fronted PocketBase stack on a VPS with Docker + Docker
# Compose, waits for PocketBase to be healthy, and bootstraps the first admin
# (superuser) non-interactively from .env. Caddy is the single public entry
# point (ports 80/443); PocketBase is only reachable inside the compose network.
#
# Usage:
#   cp .env.example .env    # edit the values (incl. TRACKER_DOMAIN)
#   ./deploy.sh             # not executable? run:  bash deploy.sh
#
# No secrets are hardcoded here — everything comes from .env.

set -euo pipefail

# Always run from the directory this script lives in (where compose + .env are).
cd "$(dirname "$0")"

ENV_FILE=".env"
COMPOSE_FILE="docker-compose.yml"
# How long to wait for the PocketBase healthcheck (seconds).
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"

log()  { printf '\033[0;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[0;33m!!\033[0m  %s\n' "$*" >&2; }
die()  { printf '\033[0;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Prerequisites
# ---------------------------------------------------------------------------
log "Checking prerequisites..."

command -v docker >/dev/null 2>&1 \
  || die "docker not found. Install Docker: https://docs.docker.com/engine/install/"

# Prefer the Compose v2 plugin (`docker compose`); fall back to legacy binary.
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  die "Docker Compose not found. Install the Compose v2 plugin: https://docs.docker.com/compose/install/"
fi

[ -f "$ENV_FILE" ] \
  || die "$ENV_FILE not found. Copy the template first:  cp .env.example .env  (then edit it)."

# Load .env so we can read admin creds + domain for the summary. Values are only
# used locally; they are also passed to compose via --env-file below.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${PB_ADMIN_EMAIL:?PB_ADMIN_EMAIL missing in $ENV_FILE}"
: "${PB_ADMIN_PASSWORD:?PB_ADMIN_PASSWORD missing in $ENV_FILE}"
: "${TRACKER_DOMAIN:?TRACKER_DOMAIN missing in $ENV_FILE}"

# Warn (but don't fail) if the PWA build isn't present yet — Caddy will still
# start and serve /api, but the site itself will 404 until dist/ exists.
if [ ! -f "./dist/index.html" ]; then
  warn "./dist/index.html not found — the PWA build isn't in place yet."
  warn "Build the client (npm run build) and copy its dist/ into server/dist/."
fi

# ---------------------------------------------------------------------------
# 2. Pull pinned images + bring the stack up
# ---------------------------------------------------------------------------
log "Pulling pinned images..."
"${COMPOSE[@]}" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull

log "Starting the stack (pocketbase + caddy)..."
"${COMPOSE[@]}" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# ---------------------------------------------------------------------------
# 3. Wait for PocketBase to be healthy (poll /api/health inside the container)
# ---------------------------------------------------------------------------
log "Waiting for PocketBase to become healthy (up to ${HEALTH_TIMEOUT}s)..."
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
until "${COMPOSE[@]}" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
      exec -T pocketbase wget -qO- http://localhost:8090/api/health >/dev/null 2>&1; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    warn "PocketBase did not become healthy in time. Recent logs:"
    "${COMPOSE[@]}" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail=50 pocketbase >&2 || true
    die "Aborting. Fix the issue above and re-run ./deploy.sh."
  fi
  printf '.'
  sleep 3
done
printf '\n'
log "PocketBase is healthy."

# ---------------------------------------------------------------------------
# 4. Bootstrap the first admin (superuser) — idempotent (`upsert`)
# ---------------------------------------------------------------------------
# Safe to re-run: `superuser upsert` creates the account or updates its password.
log "Ensuring the admin (superuser) exists..."
"${COMPOSE[@]}" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
  exec -T pocketbase /usr/local/bin/pocketbase superuser upsert \
  "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD"

# ---------------------------------------------------------------------------
# 5. Summary + next steps
# ---------------------------------------------------------------------------
if [ "$TRACKER_DOMAIN" = "localhost" ]; then
  base="https://localhost"
else
  base="https://$TRACKER_DOMAIN"
fi

cat <<EOF

$(log "Deploy complete.")

  Admin UI : ${base}/_/
  API      : ${base}/api/
  Admin    : ${PB_ADMIN_EMAIL}

Next steps:
  - Point the client at this backend:  VITE_PB_URL=${base}
    (rebuild the PWA and place its dist/ in server/dist/ for Caddy to serve).
  - First deploy: DNS for ${TRACKER_DOMAIN} must resolve to this VPS and ports
    80 + 443 must be open so Let's Encrypt can issue the certificate.
  - Re-run ./deploy.sh anytime to pull new images / re-apply — it's idempotent.
  - Logs:    ${COMPOSE[*]} -f ${COMPOSE_FILE} logs -f
  - Backups: the pb_data volume is the whole DB — snapshot it periodically.
EOF
