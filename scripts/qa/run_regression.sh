#!/usr/bin/env bash
# Full regression: picks emulator/simulator targets, builds + installs the app, runs the Maestro
# suite on each platform, scans for crashes, and writes a summary per platform.
#
# Usage: scripts/qa/run_regression.sh [--skip-build] [flow files or folders...]
#   default flows: .maestro/flows
#   QA_PLATFORM=auto|android|ios|both   (see select_targets.sh)
#   QA_TAGS=smoke                       only flows with these tags
# Exit 0 only if every platform passed with no crashes.
set -uo pipefail
source "$(dirname "$0")/_common.sh"
require_maestro

SKIP_BUILD=0
if [ "${1:-}" = "--skip-build" ]; then SKIP_BUILD=1; shift; fi
FLOWS=("$@"); [ ${#FLOWS[@]} -eq 0 ] && FLOWS=(.maestro/flows)
for f in "${FLOWS[@]}"; do [ -e "$f" ] || die "$f not found — QA must write Maestro flows first."; done

targets="$("$QA_ROOT/scripts/qa/select_targets.sh" | awk -F'\t' '$4!="bootable"')" || true
[ -n "$targets" ] || die "no emulator/simulator available (run scripts/qa/select_targets.sh to see why)"

RUN="$QA_OUT_DIR/regression_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RUN"
commit="$(git rev-parse --short HEAD 2>/dev/null || echo n/a)"
overall=0

junit_counts() { # prints "tests failures"
  python3 - "$1" <<'PY'
import sys, xml.etree.ElementTree as ET
try: r = ET.parse(sys.argv[1]).getroot()
except Exception: print("0 0"); sys.exit()
suites = [r] if r.tag == "testsuite" else r.findall("testsuite")
t = sum(int(s.get("tests", 0)) for s in suites)
f = sum(int(s.get("failures", 0)) + int(s.get("errors", 0)) for s in suites)
print(t, f)
PY
}

while IFS=$'\t' read -r platform device name _state <&3; do
  [ -n "$platform" ] || continue
  out="$RUN/$platform"; mkdir -p "$out"
  app_id="$(app_id_for "$platform")"
  [ -n "$app_id" ] || { warn "cannot detect $platform app id (set ANDROID_APP_ID / IOS_BUNDLE_ID)"; overall=1; continue; }
  echo; log "$platform on $name [$device] — app $app_id"
  start=$(date +%s)

  # Build + install
  if [ $SKIP_BUILD = 0 ] || { [ "$platform" = android ] && [ ! -f "$ANDROID_APK" ]; } || { [ "$platform" = ios ] && [ ! -d "$IOS_APP" ]; }; then
    "$QA_ROOT/scripts/qa/build_app.sh" "$platform" </dev/null 2>&1 | tee "$out/build.log"
    [ "${PIPESTATUS[0]}" -eq 0 ] || { echo "- Result: BUILD FAILED" > "$out/summary.md"; overall=1; continue; }
  fi
  if [ "$platform" = android ]; then
    adb_e "$device" install -r -d "$ANDROID_APK" >"$out/install.log" 2>&1 || { warn "install failed, see $out/install.log"; overall=1; continue; }
    adb_e "$device" logcat -c
    adb_e "$device" logcat -v time > "$out/device.log" 2>&1 &
    LOGPID=$!
  else
    xcrun simctl install "$device" "$IOS_APP" >"$out/install.log" 2>&1 || { warn "install failed, see $out/install.log"; overall=1; continue; }
    exe="$(/usr/libexec/PlistBuddy -c 'Print CFBundleExecutable' "$IOS_APP/Info.plist" 2>/dev/null)"
    marker="$out/.start"; touch "$marker"
    xcrun simctl spawn "$device" log stream --style compact --level error \
      --predicate "process == \"${exe:-none}\"" > "$out/device.log" 2>&1 &
    LOGPID=$!
  fi

  # Run Maestro
  tag_args=(); [ -n "${QA_TAGS:-}" ] && tag_args=(--include-tags="$QA_TAGS")
  maestro --device="$device" test "${FLOWS[@]}" \
    --format=JUNIT --output="$out/report.xml" \
    --debug-output="$out/debug" --test-output-dir="$out/artifacts" --flatten-debug-output \
    ${tag_args[@]+"${tag_args[@]}"} -e APP_ID="$app_id" -e PLATFORM="$platform" </dev/null 2>&1 | tee "$out/maestro.log"
  rc=${PIPESTATUS[0]}
  kill "$LOGPID" 2>/dev/null; wait "$LOGPID" 2>/dev/null

  # Final screenshot + crash scan
  if [ "$platform" = android ]; then
    adb_e "$device" exec-out screencap -p > "$out/final_screen.png" 2>/dev/null
    grep -E "FATAL EXCEPTION|ANR in|Fatal signal|ReactNativeJS.*(Error|Exception)|E/ReactNativeJS" "$out/device.log" > "$out/crashes.txt" || true
    os="Android API $(adb_e "$device" shell getprop ro.build.version.sdk | tr -d '\r')"
  else
    xcrun simctl io "$device" screenshot "$out/final_screen.png" >/dev/null 2>&1
    : > "$out/crashes.txt"
    find "$HOME/Library/Logs/DiagnosticReports" -newer "$marker" \( -name "${exe:-__none__}*.ips" -o -name "${exe:-__none__}*.crash" \) 2>/dev/null \
      | while read -r c; do echo "CRASH REPORT: $c"; cp "$c" "$out/"; done >> "$out/crashes.txt"
    os="${name#*(}"; os="${os%)}"
  fi

  read -r tests failed < <(junit_counts "$out/report.xml")
  crashes="$(grep -c . "$out/crashes.txt" 2>/dev/null)"; crashes="${crashes:-0}"
  result=PASS; { [ "$rc" -ne 0 ] || [ "${failed:-0}" -gt 0 ] || [ "$crashes" -gt 0 ]; } && result=FAIL
  [ $result = FAIL ] && overall=1
  {
    echo "# Regression — $platform"
    echo "- Result: **$result** (maestro exit $rc)"
    echo "- Flows: $(( ${tests:-0} - ${failed:-0} ))/${tests:-0} passed"
    echo "- Device: $name [$device] — $os"
    echo "- App: $app_id · Commit: $commit"
    echo "- Duration: $(( $(date +%s)-start ))s"
    echo "- Crash/error lines: $crashes $( [ "$crashes" -gt 0 ] && echo "(see crashes.txt)")"
    if [ "${failed:-0}" -gt 0 ] || [ "$rc" -ne 0 ]; then
      echo; echo "## Failures"; echo '```'
      grep -E "FAILED|❌|Assertion|is not visible|not found" "$out/maestro.log" | head -n 30
      echo '```'
      echo "Failure screenshots: $out/debug, $out/artifacts"
    fi
  } > "$out/summary.md"
  cat "$out/summary.md"
done 3<<< "$targets"

{
  echo "# Regression run $(basename "$RUN") — $( [ $overall -eq 0 ] && echo PASS || echo FAIL )"
  for s in "$RUN"/*/summary.md; do [ -f "$s" ] && { echo; cat "$s"; }; done
} > "$RUN/summary.md"
echo; echo "evidence: $RUN"
exit $overall
