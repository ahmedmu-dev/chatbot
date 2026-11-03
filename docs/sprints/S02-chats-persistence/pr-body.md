## Summary
Parley now keeps many chats and saves them on the device. Chats live in a ChatGPT-style drawer: newest first, with title, preview and time. Each chat gets an automatic title from its first prompt. You can rename or delete a chat with a long press, and everything survives an app restart. Every chat stays independent, even when you switch chats while a reply is loading.

**Sprint:** `S02-chats-persistence` · [requirements](docs/sprints/S02-chats-persistence/requirements.md) · [stories](docs/sprints/S02-chats-persistence/stories.md) · [QA report](docs/sprints/S02-chats-persistence/qa-report.md)

## Stories & acceptance criteria
| Story | AC | Android (Samsung SM-S938W) | iOS |
|---|---|---|---|
| US-1 Saved chats | AC-1 save on first send, AC-2 3 chats survive kill/relaunch, AC-3 write-through, AC-4 pending → error on restart, AC-5 schema v1 (FKs, cascade, indexes) | ✅ (AC-4, AC-5: Jest only) | not tested |
| US-2 Drawer and list | AC-6 launch on new chat, AC-7 list (title / preview / locale time), AC-8 empty state, AC-9 open chat, AC-10 New chat, AC-11 reorder on send, AC-12 Android back closes drawer | ✅ (edge swipe: Jest config only, see notes) | not tested |
| US-3 Auto title | AC-13 first ~40 chars at a word boundary + "…", AC-14 rename wins | ✅ | not tested |
| US-4 Rename and delete | AC-15 long-press menu, AC-16 rename dialog (trimmed, non-empty, max 60), AC-17 delete confirmation, AC-18 cascade delete; open chat → new chat | ✅ | not tested |
| US-5 Independent chats | AC-19 history only from the current chat, AC-20 in-flight reply lands in its own chat | ✅ (AC-20: Jest only) | not tested |

## Tasks
- [x] DEV-1 SQLite persistence (schema v1, repository interface + in-memory fake, pending → error)
- [x] DEV-2 Redux multi-chat (write-through, auto title, rename/delete, per-chat routing)
- [x] DEV-3 Drawer navigation (header ☰ / title / New chat, launch, Android back)
- [x] DEV-4 Drawer list (preview, locale time, highlight, empty state)
- [x] DEV-5 Long-press menu, rename dialog, delete confirmation
- [x] QA-1 Test plan + testID contract
- [x] QA-2 Maestro flows: `chats_persistence`, `chats_drawer_switch`, `chats_rename`, `chats_delete`, plus the S01 flows
- [x] BUG-1 (Low, test gap) Jest test for the drawer layout config

## Test evidence
- Typecheck, lint, format: clean
- Jest: **164/164**, line coverage **94.1%**
- Maestro regression (fake provider, no API cost):

| Platform | Device | OS | Flows | Crashes |
|---|---|---|---|---|
| Android phone | Samsung SM-S938W (USB), release build | Android | **8/8** (4 S01 + 4 S02) | 0 |
| iPhone | not run, no iPhone connected | n/a | n/a | n/a |

- Native changes: **new native modules** `expo-sqlite`, `expo-crypto`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets` (reanimated 4 needs it), all installed with `npx expo install` for SDK 58. The `expo-sqlite` plugin was added to `app.config.ts`. **Needs a native rebuild.**

## QA verdict
**PASS**, signed off by `qa`. **Platforms not tested: iOS.**

## Reviewer notes
- **Changed from intake: the long-press menu and the delete confirmation are custom in-app dialogs, not the native action sheet / Alert.** dev switched so every button has a testID. They look the same on Android and iOS. If you prefer the native system menu, say so in review and we'll switch back (flows can find native buttons by text).
- **Edge swipe on Android gesture navigation:** on this phone, a swipe from the left edge triggers Android's system back gesture, so the drawer opens via ☰ only. The swipe is enabled and Jest asserts it, and it should work on 3-button navigation and iOS. Possible follow-up: a wider swipe area, or rely on ☰ only.
- Lead defaults applied (stories.md): a new chat is saved only on its first send; rename doesn't reorder; the preview is plain text with Markdown stripped; the rename limit is 60; the delete copy is as specified; deleting the open chat opens a new chat.
- **Not verified on device:** date-format rows (only today's "10:20 PM" was seen), killing the app mid-reply (pending → error), and switching chats during an in-flight reply. All three are covered by Jest.
- **S01 tests were updated:** the state shape changed and "New chat" now keeps the previous chat saved. The S01 behaviour still passes (Jest and the 4 S01 flows on device).
- **Out of scope, coming in S03:** settings, model picker, Clear all chats, Stop button, token budget, dark mode, and 100+ chats under 500 ms (the drawer already uses a virtualised FlatList).

---
_Prepared by the agent team (scrum-master · rn-dev · qa-engineer). Human review and merge required._

🤖 Generated with [Claude Code](https://claude.com/claude-code)
