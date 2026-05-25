#!/bin/bash
# Apply additive, idempotent SQL migrations to the production database.
# ---------------------------------------------------------------------
# IMPORTANT: this project does NOT use `prisma db push`. The database holds
# `sync_*` staging tables (created by the FoxPro sync engine, ~1.2M rows) that
# are NOT in schema.prisma — `db push` would try to DROP them. Instead we apply
# hand-written, idempotent SQL (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT
# EXISTS) so only the new objects are touched.
#
# Run from the repo root. Reads DATABASE_URL from backend/.env (override with
# ENV_FILE=...). Safe to run repeatedly.
set -e

ENV_FILE="${ENV_FILE:-backend/.env}"
SQL_DIR="${SQL_DIR:-backend/prisma/sql}"

if [ ! -f "$ENV_FILE" ]; then
  echo "✗ $ENV_FILE not found. Run from the repo root."
  exit 1
fi

DB_URL="${DATABASE_URL:-}"
if [ -z "$DB_URL" ]; then
  DB_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
fi
if [ -z "$DB_URL" ]; then
  echo "✗ DATABASE_URL not set and not found in $ENV_FILE"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "✗ psql is not installed. Install it with:"
  echo "    apt-get update && apt-get install -y postgresql-client"
  exit 1
fi

shopt -s nullglob
files=$(ls "$SQL_DIR"/*.sql 2>/dev/null | sort)
if [ -z "$files" ]; then
  echo "No SQL migrations found in $SQL_DIR — nothing to apply."
  exit 0
fi

echo "▶ Applying idempotent SQL migrations from $SQL_DIR ..."
for f in $files; do
  echo "   • $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "✓ Schema migrations applied (sync_* tables untouched)."
