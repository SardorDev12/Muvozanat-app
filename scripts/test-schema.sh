#!/usr/bin/env bash
#
# Applies every migration to a throwaway Postgres and runs the behavioural
# assertions in supabase/tests/schema_test.sql.
#
# This is what catches the things a typecheck cannot: a non-immutable
# generated column, a trigger that never fires, an RLS policy that lets one
# user read another's rows.
#
# Usage:
#   scripts/test-schema.sh                 # starts a temporary cluster
#   DATABASE_URL=postgres://... scripts/test-schema.sh   # uses an existing one
#
# The temporary-cluster path needs a non-root user, because initdb refuses to
# run as root. In CI, and in any root container, point DATABASE_URL at a
# Postgres service instead.
set -euo pipefail

cd "$(dirname "$0")/.."

PSQL_ARGS=()
if [[ -n "${DATABASE_URL:-}" ]]; then
  PSQL_ARGS=("$DATABASE_URL")
else
  PGBIN="${PGBIN:-$(pg_config --bindir 2>/dev/null || echo /usr/lib/postgresql/16/bin)}"
  PGDATA="$(mktemp -d)/pgdata"
  PGPORT="${PGPORT:-55432}"
  PGSOCK="$(mktemp -d)"

  cleanup() { "$PGBIN/pg_ctl" -D "$PGDATA" stop -m immediate >/dev/null 2>&1 || true; }
  trap cleanup EXIT

  "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust >/dev/null
  "$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/log" \
    -o "-p $PGPORT -k $PGSOCK" -w start >/dev/null
  PSQL_ARGS=(-h "$PGSOCK" -p "$PGPORT" -U postgres)
fi

run() { psql "${PSQL_ARGS[@]}" -v ON_ERROR_STOP=1 -q "$@"; }

# A fresh public schema, so the script is safe to re-run against one cluster.
run -c 'drop schema if exists public cascade; drop schema if exists auth cascade; create schema public;' 2>/dev/null

echo "› stub"
run -f supabase/tests/stub.sql

for migration in supabase/migrations/*.sql; do
  echo "› $(basename "$migration")"
  run -f "$migration"
done

echo "› assertions"
psql "${PSQL_ARGS[@]}" -v ON_ERROR_STOP=1 -f supabase/tests/schema_test.sql >/dev/null

echo "✓ schema tests passed"
