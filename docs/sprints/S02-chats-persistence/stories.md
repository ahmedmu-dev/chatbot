# S02-chats-persistence: stories

App **Parley**. Builds on S01 (merged in PR #1): the single in-memory chat becomes many saved chats, kept in a drawer.

## PO decisions (intake, 2026-11-03)
1. Drawer layout (ChatGPT style): the list is in a side drawer; the chat fills the screen.
2. Rename and Delete via a **long-press menu** on a drawer row.
3. Last-updated time is **absolute** (time today, else date, device locale).
4. Launch opens a **new empty chat, drawer closed**.
5. Title = first ~40 characters of the first prompt (no LLM call).

## Lead defaults (from the requirements; the PO can change any of these at review)
- **Unsaved new chat (FR1).** A new chat is not saved and doesn't appear in the drawer until its first message is sent. Leaving it unsent discards it. Tapping New chat while already on an empty new chat does nothing.
- **Title.** From the first prompt: whitespace collapsed and trimmed; if longer than 40 characters, cut at the last word boundary within 40 and add "…". Set when the first message is sent. A rename always wins, and the auto title never overwrites it.
- **Rename.** A dialog prefilled with the current title. The value is trimmed; empty is not allowed (Save disabled); max 60 characters. Same custom dialog on Android and iOS (Android has no native prompt).
- **Delete.** Confirmation "Delete chat?" / "This deletes "<title>" and all its messages. This can't be undone." with Cancel and Delete (destructive). Deleting the open chat switches to a new empty chat.
- **Preview.** The last message's text with Markdown stripped to plain text, on 1 line. A failed last message shows its own text.
- **Ordering.** Newest `updatedAt` first, where `updatedAt` = time of the latest message in the chat (rename does not reorder).
- **Pending on restart.** A message still `pending` when the app was killed becomes `error` on next launch, so Retry is offered and it's never lost (FR7).
- **Switching during a request.** You may switch chats while a reply is in flight. The reply lands in the chat it belongs to, never the visible one.
- **Model.** Each chat stores the default model (`claude-opus-5-5`) at creation; S03 adds the picker.

## Technical decisions (lead)
- Drawer: expo-router `Drawer` (`@react-navigation/drawer`), which needs `react-native-gesture-handler` and `react-native-reanimated`. These are native modules; flag them in READY FOR TEST and install with `npx expo install` so versions match SDK 58. No other upgrades.
- Persistence: `expo-sqlite`. Tables `chats` and `messages` per the data model, `PRAGMA foreign_keys = ON`, `messages.chatId REFERENCES chats(id) ON DELETE CASCADE`, an index on `messages(chatId, createdAt)` and an index on `chats(updatedAt)`. Use `PRAGMA user_version` for schema v1 so later migrations are possible. Keep all SQL in a small repository module (`src/db/…`) behind an interface, so Redux thunks and tests don't touch SQLite directly. Jest uses an in-memory fake of that interface.
- Redux stays the source of UI state. On launch, load the chat list (no messages). Load a chat's messages when it's opened. Write every message and status change through to SQLite.
- IDs: uuid v4 (`expo-crypto` `randomUUID`, or the existing helper if there is one).

## UI direction (extends S01; same theme tokens)
- Header: ☰ menu button (left), chat title in the centre ("New chat" when unsaved, truncated to 1 line), New chat button (right).
- Drawer (about 85% width, max 320): "New chat" button at the top, then the list. Each row: title (bold, 1 line), preview (secondary text, 1 line), time on the right (small, secondary). The open chat is highlighted with the surface colour.
- Empty state in the drawer: "No chats yet" / "Start a conversation and it'll show up here."
- Android back: closes the drawer if it's open; otherwise default behaviour (the app goes to the background).

---

## US-1 Saved chats (persistence)
As a user, I want my chats saved on the device, so that they survive an app restart.
- **AC-1** Given a new empty chat, Then nothing is written to the database and it isn't listed in the drawer. When I send the first message, Then the chat (with `model` = default) and the message are saved and the chat appears at the top of the drawer.
- **AC-2** Given I created 3 chats with messages in each, When I kill and reopen the app, Then the drawer lists all 3 and opening each shows its full history in order (requirements §10).
- **AC-3** Given every message create or status change (pending → sent / error, Retry), Then it's written to SQLite, so the stored state matches the screen.
- **AC-4** Given a message was `pending` when the app was killed, When the app starts, Then that message shows as `error` with Retry (FR7: never lost).
- **AC-5** Given the schema, Then `chats` and `messages` exist with the data-model columns, an index on `messages.chatId`, foreign keys on, and `ON DELETE CASCADE`. `user_version` = 1.

## US-2 Drawer and chat list
As a user, I want to see and switch between my chats, so that I can keep several conversations.
- **AC-6** Given the app launches, Then a new empty chat ("Ask anything") shows with the drawer closed. The header shows ☰, "New chat" and the New chat button.
- **AC-7** When I tap ☰ or swipe from the left edge, Then the drawer opens with "New chat" and the chats newest first. Each row shows the title, a 1-line plain-text preview of the last message, and the last-updated time: the time if today (e.g. "14:05"), else the date (e.g. "03/11/2026"), both in the device locale.
- **AC-8** Given there are no saved chats, Then the drawer shows "No chats yet" / "Start a conversation and it'll show up here."
- **AC-9** When I tap a chat in the drawer, Then the drawer closes and that chat opens with its full history, scrolled to the newest message. The header shows its title, and its row is highlighted.
- **AC-10** When I tap "New chat" (drawer or header), Then a new empty chat opens. If I'm already on an empty new chat, nothing changes. An unsent new chat is discarded when I leave it.
- **AC-11** Given I send a message in any chat, Then that chat moves to the top of the drawer and its preview and time update.
- **AC-12 (Android only)** Given the drawer is open, When I press back, Then the drawer closes and the app stays open.

## US-3 Auto title
As a user, I want each chat to get a title automatically, so that I can recognise it in the list.
- **AC-13** Given I send the first message of a new chat, Then its title is set from that prompt: whitespace collapsed and trimmed, and if over 40 characters, cut at the last word boundary within 40 plus "…" (a single word longer than 40 is cut at 40 plus "…"). The title shows in the header and the drawer.
- **AC-14** Given a chat was renamed, When more messages are sent, Then its title doesn't change.

## US-4 Rename and delete
As a user, I want to rename and delete chats, so that I can keep the list tidy.
- **AC-15** When I long-press a chat row, Then a menu offers Rename, Delete and Cancel.
- **AC-16** When I choose Rename, Then a dialog opens prefilled with the current title. Save is disabled while the trimmed text is empty. The input allows at most 60 characters. Save updates the title in the drawer, the header (if open) and the database. Cancel changes nothing.
- **AC-17** When I choose Delete, Then a confirmation shows "Delete chat?" / "This deletes "<title>" and all its messages. This can't be undone." with Cancel and Delete. Cancel changes nothing.
- **AC-18** When I confirm Delete, Then the chat and all its messages are removed from the drawer and the database (cascade), and they stay gone after a restart. If it was the open chat, a new empty chat opens.

## US-5 Independent chats
As a user, I want every chat to be separate, so that one conversation never leaks into another.
- **AC-19** Given two chats, When I ask a follow-up in chat B, Then the request contains only chat B's messages (system prompt + B's sent history + the new message) (requirements §10).
- **AC-20** Given a reply is in flight in chat A, When I switch to chat B, Then the reply (or error) is saved to chat A only. Chat B is unchanged, and A shows it when I return. Send in B works normally.

## Out of scope (S02)
Settings, model picker, Clear all chats, context token budget, Stop button, dark mode, the 100+ chats under 500 ms target (S03, though the drawer must use a virtualised list). Search, pinning, swipe actions, LLM-generated titles, sync and v2 HR actions.
