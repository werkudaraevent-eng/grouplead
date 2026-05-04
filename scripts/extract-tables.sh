#!/bin/bash
# Quick-extract all CREATE TABLE statements from migrations.
# No Docker needed — just parses SQL files.
#
# Usage: bash scripts/extract-tables.sh
# Output: prints to stdout. Pipe to file if needed.

set -euo pipefail

MIGRATIONS_DIR="supabase/migrations"

echo "=== Tables found in migrations ==="
echo ""

grep -rh "CREATE TABLE" "$MIGRATIONS_DIR"/*.sql 2>/dev/null \
  | sed 's/CREATE TABLE IF NOT EXISTS/CREATE TABLE/' \
  | sed 's/CREATE TABLE//' \
  | sed 's/(.*//; s/^ *//; s/ *$//' \
  | sort -u \
  | while read -r table; do
    echo "  📋 $table"
  done

echo ""
echo "=== Foreign Keys ==="
echo ""

grep -rh "REFERENCES" "$MIGRATIONS_DIR"/*.sql 2>/dev/null \
  | sed 's/^[[:space:]]*//' \
  | sort -u \
  | head -50

echo ""
echo "(showing first 50 FK references)"
