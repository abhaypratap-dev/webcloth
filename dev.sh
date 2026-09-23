#!/usr/bin/env bash
# Start the whole platform locally: API + both storefronts + the console.
#
#   ./dev.sh            start everything (Ctrl+C stops everything)
#
# The API reads backend/.env.local before backend/.env, so it runs against
# your LOCAL Postgres even though .env holds the deployed credentials. If
# .env.local is missing this refuses to start rather than risk migrating
# the live database.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGS="$ROOT/.dev-logs"
mkdir -p "$LOGS"

if [[ ! -f "$ROOT/backend/.env.local" ]]; then
  echo "backend/.env.local is missing — refusing to start against whatever .env points at."
  echo "Copy the local-database block from PRODUCTION.md into backend/.env.local first."
  exit 1
fi

pids=()
cleanup() {
  echo; echo "Stopping…"
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

start() {  # name dir command...
  local name="$1" dir="$2"; shift 2
  (cd "$dir" && "$@") >"$LOGS/$name.log" 2>&1 &
  pids+=($!)
  printf "  %-13s pid %-6s log .dev-logs/%s.log\n" "$name" "$!" "$name"
}

echo "Migrating (master, then every brand)…"
(cd "$ROOT/backend" && .venv/bin/python manage.py migrate --verbosity 0 \
  && .venv/bin/python manage.py migrate_all_tenants --verbosity 0 | tail -1)

echo "Starting:"
start api        "$ROOT/backend"             .venv/bin/python manage.py runserver 127.0.0.1:8000
start cutcult    "$ROOT"                     npx vite dev --port 3000 --host localhost
start orenda     "$ROOT/orenda-atelier-main" npx vite dev --port 3001 --host localhost
start console    "$ROOT/saas-console"        npx vite --port 3002 --host localhost

cat <<'TXT'

  API            http://localhost:8000/api/health/
  Cut & Cult     http://localhost:3000        admin at /admin
  Label Orenda   http://localhost:3001        admin at /admin
  Console        http://localhost:3002

Ctrl+C to stop everything.
TXT
wait
