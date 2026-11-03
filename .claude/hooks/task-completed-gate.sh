#!/usr/bin/env bash
# Quality gate for the agent team's shared task list.
# Runs on every TaskCompleted event. Exit 2 = refuse completion and send stderr back to the agent.
#   [DEV-n] / [BUG-n]          -> typecheck, lint, format check, Jest must pass
#   [QA] Sign-off / [SM] ...PR -> newest docs/sprints/*/qa-report.md must say **Verdict:** PASS
set -uo pipefail

input="$(cat)"
subject="$(jq -r '.task_subject // .task.subject // .subject // ""' <<<"$input" 2>/dev/null)"
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

fail() { echo "QUALITY GATE FAILED for '$subject': $1" >&2; [ -n "${2:-}" ] && echo "$2" | tail -n 60 >&2; exit 2; }

# Package manager from lockfile.
if   [ -f yarn.lock ];      then PM=yarn
elif [ -f pnpm-lock.yaml ]; then PM=pnpm
elif [ -f bun.lockb ] || [ -f bun.lock ]; then PM=bun
else PM=npm; fi

has_script() { jq -e --arg s "$1" '.scripts[$s] // empty' package.json >/dev/null 2>&1; }
run_script() { if [ "$PM" = yarn ]; then yarn "$@"; else "$PM" run "$@"; fi; }

case "$subject" in
  "[DEV"*|"[BUG"*)
    [ -f package.json ] || fail "no package.json in project root."

    # Typecheck
    if has_script typecheck; then out="$(run_script typecheck 2>&1)" || fail "typecheck failed." "$out"
    elif has_script tsc;     then out="$(run_script tsc 2>&1)"       || fail "typecheck failed." "$out"
    elif [ -f tsconfig.json ]; then out="$(npx --no-install tsc --noEmit 2>&1)" || fail "tsc --noEmit failed." "$out"
    fi

    # Lint
    if has_script lint; then out="$(run_script lint 2>&1)" || fail "lint failed." "$out"
    elif ls .eslintrc* eslint.config.* >/dev/null 2>&1; then
      out="$(npx --no-install eslint . 2>&1)" || fail "eslint failed." "$out"
    fi

    # Format check (only if the repo uses prettier)
    if has_script "format:check"; then out="$(run_script format:check 2>&1)" || fail "format check failed. Run prettier --write on your files." "$out"
    elif ls .prettierrc* prettier.config.* >/dev/null 2>&1 || jq -e '.prettier' package.json >/dev/null 2>&1; then
      base="$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || echo HEAD~1)"
      changed="$(git diff --name-only --diff-filter=ACMR "$base" -- '*.ts' '*.tsx' '*.js' '*.jsx' 2>/dev/null)"
      if [ -n "$changed" ]; then
        # shellcheck disable=SC2086
        out="$(npx --no-install prettier --check $changed 2>&1)" || fail "prettier check failed on changed files. Run: npx prettier --write <files>" "$out"
      fi
    fi

    # Tests
    if has_script test; then
      out="$(CI=true run_script test 2>&1)" || fail "Jest tests are failing." "$out"
    else
      out="$(CI=true npx --no-install jest --ci 2>&1)" || fail "Jest tests are failing (or jest isn't installed)." "$out"
    fi
    ;;
  "[QA] Sign-off"*|"[SM] Open PR"*|"[SM] Update PR"*)
    report="$(ls -t docs/sprints/*/qa-report.md 2>/dev/null | head -n 1)"
    [ -n "$report" ] || fail "no docs/sprints/<id>/qa-report.md found."
    grep -Eq '\*\*Verdict:\*\*[[:space:]]*PASS' "$report" \
      || fail "$report does not contain '**Verdict:** PASS'."
    grep -Eqi 'Platforms tested' "$report" \
      || fail "$report must have a 'Platforms tested' section listing emulator/simulator results."
    ;;
esac
exit 0
