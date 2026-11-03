#!/usr/bin/env bash
# Shared helpers for QA scripts. Source it, don't run it.
# Env overrides:
#   QA_PLATFORM   auto | android | ios | both        (default auto)
#   ANDROID_APP_ID / IOS_BUNDLE_ID                   (default: auto-detected)
#   QA_OUT_DIR                                       (default build/qa)

QA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$QA_ROOT" || exit 1

die()  { echo "ERROR: $*" >&2; exit 1; }
warn() { echo "WARN: $*" >&2; }
log()  { echo "== $*" >&2; }

OS="$(uname -s)"
QA_OUT_DIR="${QA_OUT_DIR:-build/qa}"
APP_DIR="$QA_OUT_DIR/app"
mkdir -p "$QA_OUT_DIR" "$APP_DIR"

# ---------- package manager ----------
if   [ -f yarn.lock ];      then PM=yarn
elif [ -f pnpm-lock.yaml ]; then PM=pnpm
elif [ -f bun.lockb ] || [ -f bun.lock ]; then PM=bun
else PM=npm; fi
export PM

is_expo() { jq -e '(.dependencies.expo // .devDependencies.expo) != null' package.json >/dev/null 2>&1; }

expo_config() { # cached `expo config --json`, for dynamic app.config.* files
  local cache="$QA_OUT_DIR/expo-config.json"
  [ -s "$cache" ] || npx --no-install expo config --type public --json > "$cache" 2>/dev/null || return 1
  cat "$cache"
}

# ---------- app ids ----------
detect_android_app_id() {
  [ -n "${ANDROID_APP_ID:-}" ] && { echo "$ANDROID_APP_ID"; return; }
  local id
  id="$(grep -hEo 'applicationId[[:space:]]*=?[[:space:]]*"[^"]+"' android/app/build.gradle* 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')"
  [ -z "$id" ] && [ -f app.json ] && id="$(jq -r '.expo.android.package // empty' app.json 2>/dev/null)"
  [ -z "$id" ] && is_expo && id="$(expo_config | jq -r '.android.package // empty' 2>/dev/null)"
  echo "$id"
}
detect_ios_bundle_id() {
  [ -n "${IOS_BUNDLE_ID:-}" ] && { echo "$IOS_BUNDLE_ID"; return; }
  local id=""
  [ -f app.json ] && id="$(jq -r '.expo.ios.bundleIdentifier // empty' app.json 2>/dev/null)"
  [ -z "$id" ] && is_expo && id="$(expo_config | jq -r '.ios.bundleIdentifier // empty' 2>/dev/null)"
  if [ -z "$id" ]; then
    id="$(grep -hEo 'PRODUCT_BUNDLE_IDENTIFIER = [^;]+;' ios/*.xcodeproj/project.pbxproj 2>/dev/null \
          | sed -E 's/PRODUCT_BUNDLE_IDENTIFIER = "?([^";]+)"?;/\1/' | grep -viE 'tests?$|\$\(' | head -n1)"
  fi
  echo "$id"
}
app_id_for() { case "$1" in android) detect_android_app_id ;; ios) detect_ios_bundle_id ;; esac; }

# ---------- tool discovery ----------
SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
[ -z "$SDK_ROOT" ] && [ -d "$HOME/Library/Android/sdk" ] && SDK_ROOT="$HOME/Library/Android/sdk"
[ -z "$SDK_ROOT" ] && [ -d "$HOME/Android/Sdk" ] && SDK_ROOT="$HOME/Android/Sdk"
ADB_BIN="$(command -v adb 2>/dev/null || true)"
[ -z "$ADB_BIN" ] && [ -x "$SDK_ROOT/platform-tools/adb" ] && ADB_BIN="$SDK_ROOT/platform-tools/adb"
EMULATOR_BIN="$(command -v emulator 2>/dev/null || true)"
[ -x "$SDK_ROOT/emulator/emulator" ] && EMULATOR_BIN="$SDK_ROOT/emulator/emulator"

has_android_tools() { [ -n "$ADB_BIN" ]; }
has_ios_tools()     { [ "$OS" = "Darwin" ] && command -v xcrun >/dev/null 2>&1 && xcrun simctl help >/dev/null 2>&1; }
require_maestro()   { command -v maestro >/dev/null 2>&1 || die "maestro CLI not found. Install: curl -fsSL \"https://get.maestro.mobile.dev\" | bash"; }

# Android: only ever talk to emulators, never a physical phone.
is_android_emulator() { [[ "$1" == emulator-* ]]; }
adb_e() { local serial="$1"; shift; is_android_emulator "$serial" || die "refusing to use non-emulator Android device '$serial'"; "$ADB_BIN" -s "$serial" "$@"; }

# Resolve the device id for a platform from select_targets (running/booted only).
device_for() { # $1 platform
  QA_PLATFORM="$1" QA_NO_BOOT="${QA_NO_BOOT:-}" "$QA_ROOT/scripts/qa/select_targets.sh" \
    | awk -F'\t' -v p="$1" '$1==p && $4!="bootable"{print $2; exit}'
}

# YAML-safe quoted string (JSON strings are valid YAML).
yq_str() { python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1"; }

# Built app locations (written by build_app.sh)
ANDROID_APK="$APP_DIR/android/app.apk"
IOS_APP="$APP_DIR/ios/App.app"
