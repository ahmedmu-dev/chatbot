# S01-chat-core: task board

Branch `feature/S01-chat-core`. Statuses: todo · in-progress · ready-for-test · done. Lead keeps this file and Trello in sync.

| ID | Title | Owner | ACs | Depends on | Status |
|---|---|---|---|---|---|
| DEV-1 | Clean base: remove all grocery code, assets, tests and flows; rename to Parley / `com.ahmedmu.parley`; add Redux Toolkit, react-redux, Markdown and clipboard deps; theme tokens from the UI direction; app shell with header ("Parley" + New chat) and the empty chat screen | dev | AC-1, AC-2, AC-3 | — | done |
| DEV-2 | Proxy server in `server/` (Express + TS, `@anthropic-ai/sdk`): `/health`, `/api/chat`, error mapping, 60 s timeout, `LLM_PROVIDER=fake` mode, `.env.example`, root `npm run server`, Jest tests with a mocked SDK | dev | AC-4 – AC-7a | DEV-1 | done |
| DEV-3 | `ChatProvider` interface + `AnthropicProvider` (calls the proxy), `ChatError` codes and user messages, `EXPO_PUBLIC_API_URL`, abort signal | dev | AC-8, AC-9 | DEV-1 | done |
| DEV-4 | Redux store + chat slice: messages with status, send/retry thunks, history building (system prompt + sent messages, oldest first), New chat reset | dev | AC-16 (logic), AC-19, AC-20, AC-21, AC-22 | DEV-3 | done |
| DEV-5 | Chat screen UI: message list (user right / assistant left), Markdown and code blocks, input bar with Send enable rules, typing indicator, auto-scroll, long-press copy + "Copied", inline error + Retry, offline handling, keyboard avoiding | dev | AC-10 – AC-18 | DEV-4 | done |
| QA-1 | Test plan + testID contract | qa | all | — | done |
| QA-2 | Maestro flows for the core path (send / receive with `LLM_PROVIDER=fake`, follow-up context, error + Retry, New chat) | qa | AC-3, AC-10 – AC-12, AC-16, AC-19 – AC-22 | QA-1 | done |
| BUG-1 | Android release blocks cleartext http:// to the local proxy; all flows show offline (High) | dev | AC-8, AC-10 – AC-22 (device) | — | done |
| QA | Sign-off | qa | all | every DEV / QA / BUG (incl. BUG-1) | done (a9eeb3f) |
| SM | Open PR | lead | — | QA Sign-off | done (PR #1) |
