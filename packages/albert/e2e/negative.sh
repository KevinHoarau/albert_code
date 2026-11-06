#!/usr/bin/env bash
# Negative test: the E2E harness must detect a deliberate leak.
#   negative.sh <path to the kilo binary>
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$(bash "$here/run.sh" --leak "$@" 2>&1)"
status=$?
echo "$out"
if [ "$status" = "0" ]; then
  echo "NEGATIVE TEST FAILED: the deliberate leak was not detected"
  exit 1
fi
if ! grep -q "leak.example.org" <<<"$out"; then
  echo "NEGATIVE TEST FAILED: the harness failed, but not because of the deliberate leak"
  exit 1
fi
if ! grep -q "^scenario exit code : 0" <<<"$out"; then
  echo "NEGATIVE TEST FAILED: the scenario itself failed; only the leak should fail the run"
  exit 1
fi
echo "NEGATIVE TEST PASSED: the deliberate leak was detected"
