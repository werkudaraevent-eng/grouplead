#!/bin/bash
# Generate a current schema dump from the local Supabase instance.
# Requires: supabase CLI + Docker running with `supabase start`
#
# Usage: bash scripts/dump-schema.sh
#
# Output: docs/schema-current.sql (gitignored — for local reference only)

set -euo pipefail

OUTFILE="docs/schema-current.sql"

echo "⏳ Dumping schema from local Supabase..."

# Dump only the public schema structure (no data)
supabase db dump --schema public --data-only=false > "$OUTFILE" 2>/dev/null || {
  echo "❌ Failed. Make sure 'supabase start' is running."
  exit 1
}

echo "✅ Schema dumped to $OUTFILE ($(wc -l < "$OUTFILE") lines)"
