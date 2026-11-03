# S01-chat-core: stories

App **Parley** (`com.ahmedmu.parley`). v1 runs over 3 sprints. v2 (HR actions via MCP) is planned later, once the PO provides the HR API.

| Sprint | Scope |
|---|---|
| **S01-chat-core** (this one) | Clean Expo base, local proxy, provider abstraction, one chat screen (Markdown, copy, errors, retry, follow-up context) |
| S02-chats-persistence | Multiple chats, SQLite persistence, chat list, rename/delete, auto titles (first ~40 chars) |
| S03-settings-polish | Settings (model picker, Clear all chats), context token budget, Stop button, dark mode, 100+ chats under 500 ms |

## PO decisions (intake, 2026-11-03)
1. v1 first; v2 later with a real HR API.
2. Proxy: a local TypeScript/Express server in `server/` in this repo. The PO puts `ANTHROPIC_API_KEY` in the gitignored `server/.env`. Automated tests never call the real API.
3. Nice-to-haves in v1: **Stop button** and **Clear all chats** (both S03). No streaming. Titles use the first ~40 characters of the prompt, with no LLM call.
4. Providers: Anthropic only, behind a `ChatProvider` interface so others can be added later.
5. Name: Parley. UI: no design given; the team uses the UI direction below.

## Technical decisions (lead, from requirements + current API docs)
- Navigation: **expo-router** (Stack), which is built on React Navigation, as required. It's already in the base.
- State: **Redux Toolkit** + `react-redux` (PO decision, 2026-11-03). Use slices and thunks (`createAsyncThunk`), with typed hooks (`useAppDispatch`, `useAppSelector`). Persistence (S02): expo-sqlite.
- Markdown: `react-native-markdown-display`, or an equivalent maintained library that renders code blocks.
- Proxy calls Claude with the official `@anthropic-ai/sdk` (Messages API, non-streaming) and uses its typed errors (`AuthenticationError`, `RateLimitError`, `APIConnectionTimeoutError`, `APIConnectionError`, `APIError` with status 529/5xx). No string matching on error text.
- Models: default `claude-opus-5-5`. S03 picker adds `claude-sonnet-5-5` and `claude-haiku-5-5`. All have a 1M-token context window. Use exact IDs, no date suffixes. Thinking can't be disabled on Opus 5.5, so use `output_config: { effort: "low" }` for chat. Include the server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) and handle `stop_reason: "refusal"` as a friendly error. Use `max_tokens` ≈ 16000 for non-streaming requests.
- Default system prompt: "You are a helpful assistant." Configurable in one place.

## UI direction (no design source)
Clean and minimal, similar to well-known chat apps but with its own identity (no third-party branding).
- Colours: background `#FFFFFF`, surface `#F4F4F6`, text `#1A1A1E`, secondary text `#6B6B76`, accent `#4F46E5` (indigo), error `#D93636`. Light mode only in S01; dark mode comes in S03, so keep every colour in theme tokens.
- System font. Body 16/22, small 13/18.
- User messages: right-aligned accent bubble, white text, radius 18, max width 80%. Assistant messages: left-aligned surface bubble, max width 90%, Markdown with monospace code blocks on a darker surface that scroll horizontally.
- Input bar pinned at the bottom: rounded multiline field (grows up to 5 lines) and a circular Send button (accent; grey when disabled).
- Header: "Parley" title and a "New chat" icon button on the right.

---

## US-1 Clean base
As the team, we want the old grocery code removed and the app renamed to Parley, so that the new app starts from a clean Expo base.
- **AC-1** Given a fresh clone, When I run `npm install` then `npm run typecheck`, `lint`, `format:check` and `test`, Then all pass.
- **AC-2** Given the repo, Then there is no nectar or grocery code, asset, font, test or Maestro flow left (`grep -ri "nectar\|grocer" src __tests__ .maestro assets app.json package.json` finds nothing). The app's display name is "Parley" and its id is `com.ahmedmu.parley` on both platforms.
- **AC-3** Given a cold start, Then the app opens on the chat screen with an empty conversation and a placeholder line ("Ask anything").

## US-2 Proxy server
As the PO, I want LLM calls to go through a local proxy, so that the API key never ships in the app.
- **AC-4** Given `server/.env` contains `ANTHROPIC_API_KEY`, When I run `npm run server` (from the repo root), Then the server listens on `0.0.0.0:8787` and `GET /health` returns `200 {"ok":true}`.
- **AC-5** Given `POST /api/chat` with `{ messages: [{role, content}…], model?, system? }`, Then the proxy sends the system prompt and the messages in the same order to the Messages API and returns `200 { content: "<assistant text>" }`.
- **AC-6** Given the upstream call fails, Then the proxy returns a non-200 JSON `{ error: { code, message } }`, where `code` is one of `auth` (401/403), `rate_limit` (429), `overloaded` (529/5xx), `timeout` (no response within 60 s), `network`, `refused` (`stop_reason: "refusal"`) or `bad_request` (400 or an invalid body). The key and message contents never appear in responses or logs.
- **AC-7** Given the repo, Then `server/.env` is gitignored, `server/.env.example` lists the variable names without values, and no key exists in any committed file. Server tests use a mocked SDK and never call the network.
- **AC-7a** Given `LLM_PROVIDER=fake` in `server/.env` (or the environment), Then `/api/chat` works without a key and replies deterministically, for E2E tests and demos without cost. The reply echoes the last user message and lists the earlier user messages, so the follow-up context can be checked. A message containing `[fail:<code>]` always returns that AC-6 error. `[fail-once:<code>]` returns it only on the first request for that exact message text since the server started, and succeeds on Retry. Together they let the error and Retry flows be tested.

## US-3 Provider abstraction
As the team, we want one `ChatProvider` interface, so that other providers or streaming can be added later without touching screens.
- **AC-8** Given `ChatProvider.sendMessage(messages, { model, system, signal })`, Then `AnthropicProvider` posts to `${EXPO_PUBLIC_API_URL}/api/chat` and resolves with the assistant text. If `EXPO_PUBLIC_API_URL` is unset, it defaults to `http://localhost:8787` (Android emulator note: `10.0.2.2`). On a phone, it's the Mac's LAN IP.
- **AC-9** Given a proxy error, a non-JSON response, a fetch failure (offline), a timeout or an aborted signal, Then the provider rejects with a typed `ChatError` whose `code` maps to these user messages:
  - `network` / offline: "You're offline. Check your connection and try again."
  - `rate_limit`: "Too many requests. Wait a moment and try again."
  - `auth`: "The server couldn't authenticate with the AI provider."
  - `timeout`: "The response took too long. Try again."
  - `overloaded`: "The AI service is busy. Try again shortly."
  - `refused`: "This request couldn't be answered."
  - anything else: "Something went wrong. Try again."

## US-4 Chat screen
As a user, I want to send prompts and read the answers, so that I can chat with the assistant.
- **AC-10** Given the chat screen, Then user messages appear on the right and assistant messages on the left, oldest at the top, newest at the bottom.
- **AC-11** Given the input is empty or only whitespace, or a request is in flight, Then Send is disabled. Given text is entered and nothing is in flight, Then Send is enabled.
- **AC-12** When I tap Send, Then my message appears immediately, the input clears, and a typing indicator shows on the left until the response arrives or fails.
- **AC-13** Given an assistant response with Markdown (headings, lists, bold, inline code, fenced code blocks), Then it renders as formatted text. Code blocks are monospace and scroll horizontally.
- **AC-14** Given a new message or the typing indicator appears, Then the list scrolls to the newest item.
- **AC-15** When I long-press any message, Then its text is copied to the clipboard and a short confirmation ("Copied") shows.
- **AC-16** Given a request fails, Then my message stays in the list (status `error`, never lost), an inline error with the AC-9 text and a **Retry** button shows under it, and Send works again. When I tap Retry, Then the same message is re-sent with the same history and the error disappears. On success the reply appears.
- **AC-17** Given the device is offline, When I send, Then the app doesn't crash and shows the offline error from AC-9.
- **AC-18** Given the keyboard is open, Then the input and Send button stay visible above it on iOS and Android, and the last message is still reachable.
- **AC-19** When I tap "New chat", Then the conversation is cleared and the empty state from AC-3 shows. In S01 there is one in-memory chat, so the previous one is discarded; S02 adds persistence.

## US-5 Context
As a user, I want the assistant to remember earlier messages in the chat, so that follow-up questions work.
- **AC-20** Given a chat with earlier messages, When I send a message, Then the request contains the system prompt plus every `sent` user and assistant message of the current chat, oldest to newest, then the new user message. Typing indicators and failed attempts are not included twice.
- **AC-21** Given I asked something, When I then ask "what did I just ask?", Then the request includes my earlier question. A Jest test asserts the payload; the PO checks the real answer on device.
- **AC-22** Given I tap "New chat", When I ask "what did I just ask?", Then the request includes no messages from the previous chat.

## Out of scope (S01)
Multiple chats, the chat list, persistence, rename/delete and titles (S02). Settings, the model picker, Clear all chats, the token budget, the Stop button, dark mode and performance targets (S03). Streaming, OpenAI, summarising old messages, v2 HR actions, accounts and analytics.
