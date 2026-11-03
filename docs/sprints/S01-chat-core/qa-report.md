# QA Report: S01-chat-core
**Verdict:** PASS
Commit: e5c2e48 (app code as of 3df7845)

## Unit gate
typecheck ✓ lint ✓ format ✓  Jest 88/88, line coverage 96.83%

## AC coverage
| AC | Jest | Maestro flow | Device (Android) |
|---|---|---|---|
| AC-1, AC-2 | appConfig.test.ts, unit gate | - | n/a |
| AC-3 | ChatScreen.test (AC-3) | chat_send_receive | pass |
| AC-4, AC-7 | server/__tests__/listen.test.ts, chat.test.ts | - | server run with fake provider ok |
| AC-5, AC-6, AC-7a | server/__tests__/chat.test.ts, fake.test.ts | send_receive, error_retry | pass (fake) |
| AC-8, AC-9 | AnthropicProvider.test.ts | - | indirect (BUG-1 found and fixed) |
| AC-10, AC-11, AC-12 | ChatScreen.test, chatSlice.test | chat_send_receive | pass |
| AC-13, AC-14 | ChatScreen.test | - | not checked on device |
| AC-15 | ChatScreen.test (user and assistant, "Copied" toast) | - | clipboard content verified on device; the "Copied" toast was not captured in the screenshot (see risks) |
| AC-16, AC-17 | ChatScreen.test, chatSlice.test, AnthropicProvider.test | chat_error_retry | pass (fail-once and persistent fail). The offline error was seen on device during BUG-1. |
| AC-18 | ChatScreen.test (structural only) | - | pass on Android: input and Send are visible above the keyboard (evidence/android-ac18-keyboard.png) |
| AC-19, AC-22 | ChatScreen.test, chatSlice.test | chat_new_chat | pass |
| AC-20, AC-21 | chatSlice.test | chat_followup_context | pass |

## Device regression
| Platform | Device | OS | Flows | Crashes |
|---|---|---|---|---|
| Android phone | Samsung SM-S938W | Android (release build) | 4/4 | 0 |
| iPhone | not run: no iPhone connected | - | - | - |

Run against the proxy with LLM_PROVIDER=fake (no API cost) over LAN http://192.168.1.22:8787.

## Bugs
Found 1 / fixed 1 / open 0.
- BUG-1 High: Android release blocked cleartext http to the proxy, so all flows failed. Fixed in 3df7845 (usesCleartextTraffic via expo-build-properties); rebuilt, 4/4 pass.

## Risks / known limitations / not tested
- iOS was not tested on any device or simulator (AC-18 keyboard on iOS unverified).
- usesCleartextTraffic=true is enabled for all Android builds so the app can reach a plain-http LAN proxy. This is acceptable for a dev setup. It should be revisited before any production release.
- The "Copied" toast was not seen in the device screenshot (the keyboard was up, and the toast is brief). Jest covers it with fake timers. The clipboard content (assistant text) was seen in the keyboard clipboard suggestion.
- Real Anthropic answers are not covered (PO checks AC-21 on device with the real key). Markdown rendering (AC-13), auto-scroll (AC-14) and small screens were not checked on device.
- Android back and long-code-block horizontal scroll were not tested on device.
