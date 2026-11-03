## BUG-1  High  defect  (open)
AC: AC-8, AC-5 (all send flows on device)   Commit: 8f45d13   Found by: device Samsung SM-S938W (R3CY509CB6D)
Steps: release build with EXPO_PUBLIC_API_URL=http://192.168.1.22:8787, `LLM_PROVIDER=fake npm run server`, open app, send "hello parley".
Expected: reply "You said: hello parley".
Actual: "You're offline. Check your connection and try again." + Retry. The server log shows no request. The phone reaches the Mac (`adb shell nc -z 192.168.1.22 8787` rc=0). No usesCleartextTraffic setting in app.json or the manifest, so the Android release build blocks cleartext http://.
Fix idea (dev): allow cleartext for the dev proxy (e.g. expo-build-properties android.usesCleartextTraffic=true, or a network security config for LAN/localhost), noting a native rebuild is needed.
Evidence: ~/.maestro/tests/2026-11-03_203837/chat_send_receive/screenshots/ (4/4 flows failed at the first reply)
