#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-https://vault.neoncovenant.com}"

echo "== health =="
curl -fsS "$BASE/health" | cat

echo
echo "== list (requires Access, run from an Access-authenticated session) =="
curl -fsS "$BASE/v1/objects" | cat

echo

echo "Smoke OK"
