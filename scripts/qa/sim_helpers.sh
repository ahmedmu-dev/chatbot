#!/usr/bin/env bash
# Exploratory-testing toolbox for the Android emulator / iOS simulator. Same commands on both.
# Usage: scripts/qa/sim_helpers.sh <android|ios|auto> <command> [args]
#
#   info                    device, OS, app id
#   install                 install the last build (scripts/qa/build_app.sh)
#   launch | stop           start / terminate the app
#   reset                   fresh-install state (clear data / reinstall), then launch
#   screenshot [name]       PNG to build/qa/screens/<platform>/
#   hierarchy               list on-screen elements: testID (id), text, accessibility label, bounds
#   tap "<text>" | tap id:<testID>
#   type "<text>"           type into the focused field
#   see "<text>" | see id:<testID>     assert visible (exit 1 if not)
#   wait "<text>" | wait id:<testID> [timeout_ms]
#   scroll                  scroll down
#   back                    Android back button / iOS edge swipe-back
#   deeplink <url>          open a deep link in the app
#   dark on|off             switch system appearance
#   flow <file.yaml>        run one Maestro flow
#   crash-scan              look for crashes of the app since the last launch
#
# Only drives emulators/simulators. Taps/types/asserts run through Maestro, so they behave
# exactly like the regression flows.
set -uo pipefail
source "$(dirname "$0")/_common.sh"

platform="${1:-}"; cmd="${2:-help}"; shift 2 2>/dev/null || true
if [ "$platform" = auto ] || [ -z "$platform" ]; then
  platform="$(QA_NO_BOOT=1 "$QA_ROOT/scripts/qa/select_targets.sh" 2>/dev/null | awk -F'\t' '$4!="bootable"{print $1; exit}')"
fi
case "$platform" in android|ios) ;; *) sed -n '2,25p' "$0"; exit 1 ;; esac
[ "$cmd" = help ] && { sed -n '2,25p' "$0"; exit 0; }

device="$(QA_NO_BOOT=1 device_for "$platform")"
[ -n "$device" ] || die "no running $platform emulator/simulator. Start one with: QA_PLATFORM=$platform scripts/qa/select_targets.sh"
app_id="$(app_id_for "$platform")"
[ -n "$app_id" ] || die "cannot detect $platform app id (set ANDROID_APP_ID / IOS_BUNDLE_ID)"
SCREENS="$QA_OUT_DIR/screens/$platform"; mkdir -p "$SCREENS"
MARK="$QA_OUT_DIR/.launch_$platform"

run_steps() { # run inline Maestro commands (YAML list) against the current screen
  require_maestro
  local f="$QA_OUT_DIR/tmp_flow_$platform.yaml"
  printf 'appId: %s\n---\n%s\n' "$app_id" "$1" > "$f"
  maestro --device="$device" test "$f" -e APP_ID="$app_id" 2>&1 | grep -vE '^\s*$' | tail -n 15
  return "${PIPESTATUS[0]}"
}
selector() { # "id:foo" -> id selector, else text
  if [[ "$1" == id:* ]]; then printf '\n    id: %s' "$(yq_str "${1#id:}")"; else printf ' %s' "$(yq_str "$1")"; fi
}

case "$cmd" in
  info)
    echo "platform: $platform"; echo "device:   $device"; echo "app id:   $app_id"
    if [ "$platform" = android ]; then
      echo "os:       Android $(adb_e "$device" shell getprop ro.build.version.release | tr -d '\r') (API $(adb_e "$device" shell getprop ro.build.version.sdk | tr -d '\r'))"
    else
      xcrun simctl list devices booted | grep "$device"
    fi ;;
  install)
    if [ "$platform" = android ]; then [ -f "$ANDROID_APK" ] || die "no build; run scripts/qa/build_app.sh android"; adb_e "$device" install -r -d "$ANDROID_APK"
    else [ -d "$IOS_APP" ] || die "no build; run scripts/qa/build_app.sh ios"; xcrun simctl install "$device" "$IOS_APP"; fi ;;
  launch)
    touch "$MARK"
    if [ "$platform" = android ]; then adb_e "$device" logcat -c; adb_e "$device" shell monkey -p "$app_id" -c android.intent.category.LAUNCHER 1 >/dev/null
    else xcrun simctl launch "$device" "$app_id"; fi ;;
  stop)
    if [ "$platform" = android ]; then adb_e "$device" shell am force-stop "$app_id"; else xcrun simctl terminate "$device" "$app_id" 2>/dev/null || true; fi ;;
  reset)
    if [ "$platform" = android ]; then adb_e "$device" shell pm clear "$app_id"
    else
      [ -d "$IOS_APP" ] || die "no build to reinstall; run scripts/qa/build_app.sh ios"
      xcrun simctl terminate "$device" "$app_id" 2>/dev/null; xcrun simctl uninstall "$device" "$app_id"; xcrun simctl install "$device" "$IOS_APP"
    fi
    "$0" "$platform" launch ;;
  screenshot)
    name="${1:-shot_$(date +%H%M%S)}"; f="$SCREENS/$name.png"
    if [ "$platform" = android ]; then adb_e "$device" exec-out screencap -p > "$f"; else xcrun simctl io "$device" screenshot "$f" >/dev/null 2>&1; fi
    echo "$f" ;;
  hierarchy)
    require_maestro
    maestro --device="$device" hierarchy 2>/dev/null > "$QA_OUT_DIR/hierarchy_$platform.json" || die "maestro hierarchy failed"
    python3 - "$QA_OUT_DIR/hierarchy_$platform.json" <<'PY'
import json, sys
raw = open(sys.argv[1]).read(); raw = raw[raw.find("{"):]
def walk(n):
    a = n.get("attributes", {}) or {}
    rid = a.get("resource-id") or a.get("identifier") or ""
    txt = a.get("text") or ""
    acc = a.get("accessibilityText") or a.get("content-desc") or ""
    hint = a.get("hintText") or ""
    if rid or txt or acc or hint:
        flag = "[tap]" if str(a.get("clickable", "")).lower() == "true" else "     "
        print(f"{flag} id={rid!r} text={txt!r} label={acc!r}" + (f" hint={hint!r}" if hint else "") + f" bounds={a.get('bounds','')}")
    for c in n.get("children", []) or []: walk(c)
walk(json.loads(raw))
PY
    echo "full json: $QA_OUT_DIR/hierarchy_$platform.json" ;;
  tap)   [ -n "${1:-}" ] || die 'usage: tap "<text>" | tap id:<testID>'; run_steps "- tapOn:$(selector "$1")" ;;
  type)  [ -n "${1:-}" ] || die 'usage: type "<text>"'; run_steps "- inputText: $(yq_str "$1")" ;;
  see)   [ -n "${1:-}" ] || die 'usage: see "<text>" | see id:<testID>'; run_steps "- assertVisible:$(selector "$1")" ;;
  wait)
    [ -n "${1:-}" ] || die 'usage: wait "<text>" | wait id:<testID> [timeout_ms]'
    sel="$(selector "$1")"; [[ "$1" == id:* ]] && sel="${sel//$'\n    '/$'\n        '}"
    run_steps "- extendedWaitUntil:
    visible:$sel
    timeout: ${2:-15000}" ;;
  scroll) run_steps "- scroll" ;;
  back)
    if [ "$platform" = android ]; then adb_e "$device" shell input keyevent KEYCODE_BACK
    else run_steps "- swipe:
    start: 1%, 50%
    end: 85%, 50%
    duration: 300"; fi ;;
  deeplink)
    [ -n "${1:-}" ] || die "usage: deeplink <url>"
    if [ "$platform" = android ]; then adb_e "$device" shell am start -W -a android.intent.action.VIEW -d "$1" "$app_id" >/dev/null
    else xcrun simctl openurl "$device" "$1"; fi ;;
  dark)
    case "${1:-}" in on) m=yes; a=dark;; off) m=no; a=light;; *) die "usage: dark on|off";; esac
    if [ "$platform" = android ]; then adb_e "$device" shell cmd uimode night "$m"; else xcrun simctl ui "$device" appearance "$a"; fi ;;
  flow)
    [ -f "${1:-}" ] || die "usage: flow <file.yaml>"; require_maestro
    maestro --device="$device" test "$1" -e APP_ID="$app_id" -e PLATFORM="$platform" ;;
  crash-scan)
    if [ "$platform" = android ]; then
      if adb_e "$device" logcat -d -v time | grep -E "FATAL EXCEPTION|ANR in|Fatal signal|E/ReactNativeJS"; then echo "CRASH/ERROR LINES FOUND" >&2; exit 1; fi
    else
      exe="$(/usr/libexec/PlistBuddy -c 'Print CFBundleExecutable' "$IOS_APP/Info.plist" 2>/dev/null)"
      [ -f "$MARK" ] || touch -t "$(date -v-30M +%Y%m%d%H%M)" "$MARK"
      found="$(find "$HOME/Library/Logs/DiagnosticReports" -newer "$MARK" -name "${exe:-__none__}*" 2>/dev/null)"
      if [ -n "$found" ]; then echo "$found"; echo "CRASH REPORTS FOUND" >&2; exit 1; fi
    fi
    echo "no crashes found" ;;
  *) sed -n '2,25p' "$0"; exit 1 ;;
esac
