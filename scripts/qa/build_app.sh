#!/usr/bin/env bash
# Builds a self-contained (JS bundled, no Metro needed) app for testing on emulator/simulator.
# Usage: scripts/qa/build_app.sh android|ios
# Output: build/qa/app/android/app.apk  |  build/qa/app/ios/App.app
#
# Defaults: Android `./gradlew assembleRelease` (the RN template signs release with the debug key),
#           iOS `xcodebuild -configuration Release -sdk iphonesimulator`, no code signing.
# Expo projects without android/ or ios/ folders get `npx expo prebuild` first.
# Overrides for custom setups (flavors, schemes, monorepos):
#   ANDROID_GRADLE_TASK=assembleStagingRelease   ANDROID_BUILD_CMD="..."  ANDROID_APP_PATH=path/to.apk
#   IOS_SCHEME=MyApp  IOS_CONFIGURATION=Release  IOS_BUILD_CMD="..."      IOS_APP_PATH=path/to/My.app
set -uo pipefail
source "$(dirname "$0")/_common.sh"

platform="${1:-}"; [ -n "$platform" ] || die "usage: build_app.sh android|ios"
start=$(date +%s)

case "$platform" in
android)
  mkdir -p "$APP_DIR/android"
  if [ -n "${ANDROID_BUILD_CMD:-}" ]; then
    log "custom Android build: $ANDROID_BUILD_CMD"; bash -c "$ANDROID_BUILD_CMD" || die "Android build failed"
    apk="${ANDROID_APP_PATH:?set ANDROID_APP_PATH with ANDROID_BUILD_CMD}"
  else
    if [ ! -d android ]; then
      is_expo || die "no android/ folder and not an Expo project"
      log "expo prebuild (android)"; npx expo prebuild --platform android --no-install || die "expo prebuild failed"
    fi
    task="${ANDROID_GRADLE_TASK:-assembleRelease}"
    log "gradle $task"
    (cd android && ./gradlew "$task" --console=plain -q) 2>&1 | tail -n 40
    [ "${PIPESTATUS[0]}" -eq 0 ] || die "Android build failed (gradle $task)"
    apk="${ANDROID_APP_PATH:-}"
    if [ -z "$apk" ]; then
      apks="$(find android/app/build/outputs/apk -name '*.apk' 2>/dev/null | grep -v androidTest)"
      # shellcheck disable=SC2086
      [ -n "$apks" ] && apk="$(ls -t $apks | head -n1)"
    fi
  fi
  [ -f "$apk" ] || die "APK not found after build"
  cp "$apk" "$ANDROID_APK"
  echo "built $ANDROID_APK  (from $apk, $(( $(date +%s)-start ))s)"
  ;;
ios)
  has_ios_tools || die "iOS builds need macOS with Xcode"
  mkdir -p "$APP_DIR/ios"
  if [ -n "${IOS_BUILD_CMD:-}" ]; then
    log "custom iOS build: $IOS_BUILD_CMD"; bash -c "$IOS_BUILD_CMD" || die "iOS build failed"
    app="${IOS_APP_PATH:?set IOS_APP_PATH with IOS_BUILD_CMD}"
  else
    if [ ! -d ios ]; then
      is_expo || die "no ios/ folder and not an Expo project"
      log "expo prebuild (ios)"; npx expo prebuild --platform ios || die "expo prebuild failed"
    fi
    if [ -f ios/Podfile ] && [ ! -d ios/Pods ]; then
      log "pod install"; (cd ios && (bundle exec pod install 2>/dev/null || pod install)) || die "pod install failed"
    fi
    ws="$(ls -d ios/*.xcworkspace 2>/dev/null | head -n1)"; [ -n "$ws" ] || die "no ios/*.xcworkspace found"
    scheme="${IOS_SCHEME:-$(basename "$ws" .xcworkspace)}"
    config="${IOS_CONFIGURATION:-Release}"
    derived="$QA_OUT_DIR/ios-derived"
    log "xcodebuild $scheme ($config, iphonesimulator)"
    set -o pipefail
    xcodebuild -workspace "$ws" -scheme "$scheme" -configuration "$config" \
      -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
      -derivedDataPath "$derived" CODE_SIGNING_ALLOWED=NO build 2>&1 \
      | { command -v xcbeautify >/dev/null && xcbeautify --quiet || tail -n 40; } \
      || die "iOS build failed (xcodebuild $scheme)"
    app="${IOS_APP_PATH:-$(find "$derived/Build/Products/${config}-iphonesimulator" -maxdepth 1 -name '*.app' | head -n1)}"
  fi
  [ -d "$app" ] || die ".app not found after build"
  rm -rf "$IOS_APP"; cp -R "$app" "$IOS_APP"
  echo "built $IOS_APP  (from $app, $(( $(date +%s)-start ))s)"
  ;;
*) die "usage: build_app.sh android|ios" ;;
esac
