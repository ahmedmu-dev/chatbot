## Summary
First sprint of **Parley**, an LLM chat app. It starts from a clean Expo base and adds a local proxy that keeps the Anthropic API key out of the app, plus a single chat screen. You can send prompts and get Markdown replies, copy any message, recover from errors with Retry, and ask follow-up questions that use the chat's history.

**Sprint:** `S01-chat-core` · [requirements](docs/sprints/S01-chat-core/requirements.md) · [stories](docs/sprints/S01-chat-core/stories.md) · [QA report](docs/sprints/S01-chat-core/qa-report.md)

## Stories & acceptance criteria
| Story | AC | Android (Samsung SM-S938W) | iOS |
|---|---|---|---|
| US-1 Clean base | AC-1 checks green, AC-2 no grocery code + renamed to `com.ahmedmu.parley`, AC-3 empty chat on launch | ✅ | not tested |
| US-2 Proxy server | AC-4 `npm run server` on 0.0.0.0:8787 + `/health`, AC-5 `/api/chat` forwards the history, AC-6 error codes with no key or content in logs, AC-7 `.env` gitignored + `.env.example`, AC-7a `LLM_PROVIDER=fake` with `[fail:…]` / `[fail-once:…]` triggers | ✅ (fake provider) | n/a |
| US-3 Provider | AC-8 `ChatProvider` + `AnthropicProvider` via `EXPO_PUBLIC_API_URL`, AC-9 typed `ChatError` + user messages | ✅ | not tested |
| US-4 Chat screen | AC-10 bubbles, AC-11 Send enable rules, AC-12 typing indicator, AC-13 Markdown/code, AC-14 auto-scroll, AC-15 long-press copy, AC-16 inline error + Retry (message never lost), AC-17 offline, AC-18 keyboard, AC-19 New chat | ✅ (AC-13, AC-14: Jest only) | not tested |
| US-5 Context | AC-20 full history oldest first, AC-21 follow-up works, AC-22 no leakage between chats | ✅ (fake provider) | not tested |

## Tasks
- [x] DEV-1 Clean base, rename to Parley, Redux Toolkit / Markdown / clipboard deps, theme, app shell
- [x] DEV-2 Express proxy in `server/` (`@anthropic-ai/sdk`, typed error mapping, 60 s timeout, fake mode)
- [x] DEV-3 `ChatProvider`, `AnthropicProvider`, `ChatError`
- [x] DEV-4 Redux store + chat slice (send/retry thunks, history building, New chat)
- [x] DEV-5 Chat screen UI
- [x] QA-1 Test plan + testID contract
- [x] QA-2 Maestro flows: `chat_send_receive`, `chat_followup_context`, `chat_error_retry`, `chat_new_chat`
- [x] BUG-1 (High) Android release build blocked cleartext `http://` to the proxy. Found by QA on the phone; fixed and narrowed.
- [x] Test gap: Jest tests added for AC-4 and AC-7

## Test evidence
- Typecheck, lint, format: clean
- Jest: **92/92**, line coverage **96.83%**
- Maestro regression (fake provider, no API cost):

| Platform | Device | OS | Flows | Crashes |
|---|---|---|---|---|
| Android phone | Samsung SM-S938W (USB) | Android, release build of `e5c2e48` | 4/4 | 0 |
| iPhone | not run, no iPhone connected | n/a | n/a | n/a |

- Screenshots: `docs/sprints/S01-chat-core/qa/evidence/` (AC-15 copied, AC-18 keyboard)
- Native changes: new `expo-clipboard` (native module) and `expo-build-properties` (config only); new `app.config.ts`. **Needs a native rebuild.**

## QA verdict
**PASS**, signed off by `qa`. **Platforms not tested: iOS** (no iPhone connected; the AC-18 keyboard and the `NSAllowsLocalNetworking` setting are unverified on iOS).

## Reviewer notes
- **How to run:**
  1. Put `ANTHROPIC_API_KEY` in `server/.env` (gitignored), then run `npm run server`. Use `LLM_PROVIDER=fake` for keyless demos.
  2. Build the app with `EXPO_PUBLIC_API_URL=http://<your Mac's LAN IP>:8787`. It's read at native build time and decides whether cleartext is allowed.
- **Cleartext (BUG-1):** Android allows cleartext only when `EXPO_PUBLIC_API_URL` is `http://`, and blocks it for `https://`. iOS gets `NSAllowsLocalNetworking` only, not arbitrary loads. Revisit when the proxy is deployed behind https.
- **Model:** default `claude-opus-5-5` at low effort, with server-side refusal fallback. A refusal shows "This request couldn't be answered."
- **Not covered by tests:** real Anthropic answers (all E2E runs used the fake provider; please try a follow-up question with your key), plus Markdown rendering, auto-scroll, Android back and small screens on the device.
- **Cosmetic:** Android 13+ shows its own system "Copied" toast as well as the app's.
- Extra error codes beyond the ACs: `unknown` (server 500), `bad_request` and `aborted` all show "Something went wrong. Try again." The client timeout is 70 s; the proxy's is 60 s.
- Out of scope, coming next: S02 multiple chats + SQLite persistence; S03 settings, model picker, Stop, Clear all, token budget, dark mode.

---
_Prepared by the agent team (scrum-master · rn-dev · qa-engineer). Human review and merge required._

🤖 Generated with [Claude Code](https://claude.com/claude-code)
