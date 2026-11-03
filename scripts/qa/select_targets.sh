#!/usr/bin/env bash
# Picks the emulator / simulator to test on and prints one tab-separated line per target:
#   <platform>  <device-id>  <name / OS>  <state: running | booted | bootable>
#
# QA_PLATFORM=auto (default): use every emulator/simulator that is already running.
#                             If none is running, boot one: Android AVD first, else iOS simulator.
# QA_PLATFORM=android|ios:    that platform only (boot it if needed).
# QA_PLATFORM=both:           both platforms (boot whatever isn't running).
# QA_NO_BOOT=1:               never boot; list what's running plus what *could* be booted ("bootable").
# QA_AVD=<name>               which AVD to boot (default: first from `emulator -list-avds`).
# QA_IOS_DEVICE="iPhone 16"   which simulator to boot (default: newest iPhone on the newest iOS runtime).
# QA_SHOW_SIM=1               open the Simulator app window after booting (headless otherwise).
#
# Never selects a physical phone. Exit 1 if no target is available.
set -uo pipefail
source "$(dirname "$0")/_common.sh"

MODE="${QA_PLATFORM:-auto}"
case "$MODE" in auto|android|ios|both) ;; *) die "QA_PLATFORM must be auto|android|ios|both";; esac
NO_BOOT="${QA_NO_BOOT:-}"
BOOT_TIMEOUT="${QA_BOOT_TIMEOUT:-300}"
out=()

# ---------- Android ----------
android_running() {
  has_android_tools || return 0
  "$ADB_BIN" devices | awk 'NR>1 && $1 ~ /^emulator-/ && $2=="device"{print $1}'
}
android_name() {
  local avd api
  avd="$("$ADB_BIN" -s "$1" emu avd name 2>/dev/null | head -n1 | tr -d '\r')"
  api="$("$ADB_BIN" -s "$1" shell getprop ro.build.version.sdk 2>/dev/null | tr -d '\r')"
  echo "${avd:-emulator} (API ${api:-?})"
}
android_bootable_avd() {
  [ -n "$EMULATOR_BIN" ] || return 0
  if [ -n "${QA_AVD:-}" ]; then echo "$QA_AVD"; else "$EMULATOR_BIN" -list-avds 2>/dev/null | grep -v '^INFO' | head -n1; fi
}
android_boot() {
  local avd="$1" before serial t=0
  before="$(android_running | sort)"
  log "booting Android emulator '$avd' (headless)"
  nohup "$EMULATOR_BIN" -avd "$avd" -no-snapshot-save -no-boot-anim -no-audio -no-window >"$QA_OUT_DIR/emulator.log" 2>&1 &
  while [ $t -lt "$BOOT_TIMEOUT" ]; do
    serial="$(comm -13 <(echo "$before") <(android_running | sort) | head -n1)"
    if [ -n "$serial" ] && [ "$("$ADB_BIN" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then
      "$ADB_BIN" -s "$serial" shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1
      "$ADB_BIN" -s "$serial" shell wm dismiss-keyguard >/dev/null 2>&1
      echo "$serial"; return 0
    fi
    sleep 3; t=$((t+3))
  done
  warn "Android emulator did not finish booting in ${BOOT_TIMEOUT}s (see $QA_OUT_DIR/emulator.log)"
  return 1
}

# ---------- iOS ----------
ios_booted() { # prints "udid<TAB>name (iOS x)"
  has_ios_tools || return 0
  xcrun simctl list devices booted -j 2>/dev/null | python3 -c '
import json,sys
d=json.load(sys.stdin)["devices"]
for rt,devs in d.items():
    if "iOS" not in rt: continue
    ver=rt.split("iOS-")[-1].replace("-",".")
    for x in devs:
        if x.get("state")=="Booted": print(x["udid"]+"\t"+x["name"]+" (iOS "+ver+")")'
}
ios_bootable() { # newest iPhone on newest runtime, or QA_IOS_DEVICE
  has_ios_tools || return 0
  xcrun simctl list devices available -j 2>/dev/null | QA_IOS_DEVICE="${QA_IOS_DEVICE:-}" python3 -c '
import json,os,sys,re
want=os.environ.get("QA_IOS_DEVICE","")
d=json.load(sys.stdin)["devices"]
def ver(rt):
    m=re.search(r"iOS-(\d+)-(\d+)",rt); return (int(m.group(1)),int(m.group(2))) if m else (0,0)
best=None
for rt in sorted([r for r in d if "iOS" in r], key=ver, reverse=True):
    for x in d[rt]:
        if not x.get("isAvailable",True): continue
        if want and x["name"]!=want: continue
        if not want and not x["name"].startswith("iPhone"): continue
        best=(x["udid"], x["name"], ".".join(map(str,ver(rt)))); break
    if best: break
if best: print(f"{best[0]}\t{best[1]} (iOS {best[2]})")'
}
ios_boot() {
  local udid="$1"
  log "booting iOS simulator $udid"
  xcrun simctl boot "$udid" 2>/dev/null || true
  xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || { warn "iOS simulator $udid failed to boot"; return 1; }
  [ -n "${QA_SHOW_SIM:-}" ] && open -a Simulator >/dev/null 2>&1
  return 0
}

# ---------- decide ----------
want_android=0; want_ios=0
case "$MODE" in android) want_android=1;; ios) want_ios=1;; both|auto) want_android=1; want_ios=1;; esac

a_run="$( [ $want_android = 1 ] && android_running | head -n1 )"
i_run="$( [ $want_ios = 1 ] && ios_booted | head -n1 )"
[ -n "$a_run" ] && out+=("android	$a_run	$(android_name "$a_run")	running")
[ -n "$i_run" ] && out+=("ios	$(cut -f1 <<<"$i_run")	$(cut -f2 <<<"$i_run")	running")

need_android=0; need_ios=0
case "$MODE" in
  android) [ -z "$a_run" ] && need_android=1 ;;
  ios)     [ -z "$i_run" ] && need_ios=1 ;;
  both)    [ -z "$a_run" ] && need_android=1; [ -z "$i_run" ] && need_ios=1 ;;
  auto)    if [ -z "$a_run" ] && [ -z "$i_run" ]; then
             if [ -n "$(android_bootable_avd)" ]; then need_android=1; else need_ios=1; fi
           fi ;;
esac

if [ $need_android = 1 ]; then
  avd="$(android_bootable_avd)"
  if [ -z "$avd" ]; then
    warn "no Android emulator running and no AVD to boot (create one in Android Studio > Device Manager, or install the SDK emulator)"
  elif [ -n "$NO_BOOT" ]; then
    out+=("android	avd:$avd	$avd	bootable")
  elif serial="$(android_boot "$avd")"; then
    out+=("android	$serial	$(android_name "$serial")	booted")
  fi
fi
if [ $need_ios = 1 ]; then
  cand="$(ios_bootable)"
  if ! has_ios_tools; then
    warn "iOS simulator unavailable (needs macOS with Xcode installed)"
  elif [ -z "$cand" ]; then
    warn "no iOS simulator available (Xcode > Settings > Components to install a runtime)"
  elif [ -n "$NO_BOOT" ]; then
    out+=("ios	$(cut -f1 <<<"$cand")	$(cut -f2 <<<"$cand")	bootable")
  elif ios_boot "$(cut -f1 <<<"$cand")"; then
    out+=("ios	$(cut -f1 <<<"$cand")	$(cut -f2 <<<"$cand")	booted")
  fi
fi

# auto mode, Android failed to boot -> fall back to iOS
if [ "$MODE" = auto ] && [ ${#out[@]} -eq 0 ] && [ -z "$NO_BOOT" ] && [ $need_android = 1 ]; then
  cand="$(ios_bootable)"
  [ -n "$cand" ] && ios_boot "$(cut -f1 <<<"$cand")" && out+=("ios	$(cut -f1 <<<"$cand")	$(cut -f2 <<<"$cand")	booted")
fi

if [ ${#out[@]} -eq 0 ]; then
  echo "NO TARGET: no Android emulator or iOS simulator is running or bootable." >&2
  exit 1
fi
printf '%s\n' "${out[@]}"
