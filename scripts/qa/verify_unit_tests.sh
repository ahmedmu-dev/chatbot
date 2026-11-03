#!/usr/bin/env bash
# Runs typecheck, lint and Jest with coverage, then prints a summary QA can paste into the report.
# Usage: scripts/qa/verify_unit_tests.sh [min_coverage_percent]   (default 0 = report only)
set -uo pipefail
source "$(dirname "$0")/_common.sh"
MIN="${1:-0}"
OUT="$QA_OUT_DIR/unit_$(date +%Y%m%d_%H%M%S)"; mkdir -p "$OUT"

has_script() { jq -e --arg s "$1" '.scripts[$s] // empty' package.json >/dev/null 2>&1; }
run_script() { if [ "$PM" = yarn ]; then yarn "$@"; else "$PM" run "$@"; fi; }

tc_rc=0; lint_rc=0
log "typecheck"
if has_script typecheck; then run_script typecheck >"$OUT/typecheck.log" 2>&1 || tc_rc=1
elif [ -f tsconfig.json ]; then npx --no-install tsc --noEmit >"$OUT/typecheck.log" 2>&1 || tc_rc=1
else echo "no TypeScript" >"$OUT/typecheck.log"; fi
log "lint"
if has_script lint; then run_script lint >"$OUT/lint.log" 2>&1 || lint_rc=1
else npx --no-install eslint . >"$OUT/lint.log" 2>&1 || lint_rc=1; fi

log "jest --coverage"
CI=true npx --no-install jest --ci --coverage \
  --coverageReporters=json-summary --coverageReporters=text-summary --coverageReporters=lcov \
  --coverageDirectory="$OUT/coverage" 2>&1 | tee "$OUT/jest.log"
test_rc=${PIPESTATUS[0]}

tests_line="$(grep -E '^Tests:' "$OUT/jest.log" | tail -n1)"
coverage="n/a"
[ -f "$OUT/coverage/coverage-summary.json" ] && coverage="$(jq -r '.total.lines.pct' "$OUT/coverage/coverage-summary.json")"

echo
echo "== SUMMARY =="
echo "typecheck: $([ $tc_rc -eq 0 ] && echo clean || echo "ERRORS (see $OUT/typecheck.log)")"
echo "lint:      $([ $lint_rc -eq 0 ] && echo clean || echo "ISSUES (see $OUT/lint.log)")"
echo "jest:      ${tests_line:-no summary} (exit $test_rc)"
echo "line coverage: ${coverage}%"
echo "logs:      $OUT"

rc=0
[ $tc_rc -ne 0 ] && rc=1; [ $lint_rc -ne 0 ] && rc=1; [ $test_rc -ne 0 ] && rc=1
if [ "$coverage" != "n/a" ] && awk "BEGIN{exit !($coverage < $MIN)}"; then
  echo "coverage ${coverage}% is below the ${MIN}% threshold" >&2; rc=1
fi
exit $rc
