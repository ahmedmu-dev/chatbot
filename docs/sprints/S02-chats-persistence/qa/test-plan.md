# S02 Test plan (QA-1)

Jest = dev (unit gate, main). Flow = Maestro, core path only. Status: planned.

| AC | Jest expected (file / describe) | Flow | Status |
|---|---|---|---|
| AC-1 | db repo + chats thunks: "new chat not persisted until first send"; saved with default model | chats_persistence | planned |
| AC-2 | repo restart test (reopen fake/DB, list + messages in order); store hydrate | chats_persistence | planned |
| AC-3 | thunks: write-through on create, pending->sent, pending->error, retry | - | planned |
| AC-4 | repo/startup: "pending becomes error on launch" | - (Jest only; kill-mid-reply is flaky) | planned |
| AC-5 | schema: tables/columns, index messages(chatId,createdAt), FK on, cascade, user_version=1 | - | planned |
| AC-6 | Drawer layout/header: empty "Ask anything", drawer closed, menu/title "New chat"/new btn | chats_drawer_switch | planned |
| AC-7 | DrawerContent: order, title/preview/time, markdown stripped, time-today vs date (locale) | chats_drawer_switch | planned |
| AC-8 | DrawerContent: empty state texts | chats_persistence (first launch) | planned |
| AC-9 | DrawerContent: tap row opens chat, closes drawer, header title, highlight, scroll to newest | chats_drawer_switch | planned |
| AC-10 | New chat from drawer/header; no-op on empty new chat; unsent discarded | chats_drawer_switch | planned |
| AC-11 | send moves chat to top, preview/time update | chats_drawer_switch | planned |
| AC-12 | Android back closes drawer (BackHandler mocked, Platform.OS android); not on iOS | Android-only step in drawer flow | planned |
| AC-13 | title helper: collapse/trim, <=40 untouched, word boundary + "…", single long word cut at 40, exactly 40, 41, unicode/emoji, whitespace-only | chats_persistence | planned |
| AC-14 | renamed title not overwritten on later send | chats_rename | planned |
| AC-15 | long-press row shows Rename/Delete/Cancel | chats_rename, chats_delete | planned |
| AC-16 | rename dialog: prefill, Save disabled on empty/whitespace, maxLength 60, Save updates drawer+header+DB, Cancel no-op | chats_rename | planned |
| AC-17 | delete confirm text with title, Cancel no-op | chats_delete | planned |
| AC-18 | delete removes chat+messages (cascade), open chat -> new empty chat, gone after reopen | chats_delete | planned |
| AC-19 | send thunk: request has only system + this chat's sent history + new message | chats_drawer_switch | planned |
| AC-20 | in-flight reply lands in origin chat only after switch (success and error); B send works | Jest only (timing) | planned |

## testID contract (S01 ids unchanged)
- `drawer_menu_btn` header hamburger (S01 `chat_header`, `chat_header_title`, `chat_new_chat_btn` stay)
- `drawer_container` drawer root; `drawer_new_chat_btn`; `drawer_list` (FlatList)
- `drawer_chat_<id>` row; inside: `drawer_chat_title_<id>`, `drawer_chat_preview_<id>`, `drawer_chat_time_<id>`
- `drawer_empty_state` (+ texts "No chats yet" / "Start a conversation and it'll show up here.")
- `drawer_menu_rename`, `drawer_menu_delete`, `drawer_menu_cancel` (long-press menu)
- `rename_dialog`, `rename_input`, `rename_save_btn`, `rename_cancel_btn`, `rename_counter` (optional)
- `delete_dialog`, `delete_confirm_btn`, `delete_cancel_btn`
Flows can't look up ids by chat title, so also set `accessibilityLabel` = title on row; flows match rows by text (title) where id suffix is unknown.

## Risks dev tests must cover
- Persistence/restart: reopen repo and rehydrate store; order of messages (createdAt tie-break).
- Cascade delete on messages; foreign_keys PRAGMA actually on.
- pending -> error on startup, Retry then works and persists.
- Title edges: exactly 40, 41, one long word, multiple spaces/newlines, emoji, rename wins.
- Rename: whitespace-only, 60 vs 61 chars, trimmed saved, Cancel.
- Isolation: request payload per chat; in-flight reply routed by chatId (success + failure) while switching.
- Locale time: today vs older date, mock Date and locale; midnight boundary.
- Android back with drawer open vs closed; keyboard over rename input (dialog scrolls/avoids keyboard); small screen drawer width (85%, max 320).
- Empty / loading (chat messages load on open) / error states; DB write failure doesn't crash UI.
- Native deps (gesture-handler, reanimated, sqlite) need rebuild: Jest mocks must not hide missing babel plugin config.
