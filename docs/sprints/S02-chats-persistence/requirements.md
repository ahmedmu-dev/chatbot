# S02-chats-persistence: requirements

PO request (2026-11-03): "start S02"

Scope as planned in S01 (`docs/sprints/S01-chat-core/stories.md`): multiple chats, SQLite persistence, chat list, rename/delete, auto titles (first ~40 chars).

## Source requirements (verbatim excerpts from REQUIREMENTS.md, see S01 requirements.md for the full document)

### 3.1 Chat List (Home)
- Lists all chats, newest first, showing each chat's title, last-message preview and last-updated time
- A "New Chat" button
- Tapping a chat opens it
- Long-press or swipe on a chat offers Rename and Delete (Delete asks for confirmation)
- An empty state appears when there are no chats

### 4. Functional Requirements (S02-relevant)
- **FR1 New chat:** Create an empty chat. The chat is persisted only once its first message is sent.
- **FR3 Multiple chats:** The user can switch between chats freely. Each chat is fully independent.
- **FR4 History persistence:** All chats and messages survive an app restart.
- **FR5 Auto title:** After the first exchange, generate a short title. Use either the first ~40 characters of the user's prompt or a cheap LLM call that asks for a 3–5 word title. (PO chose first ~40 characters.)
- **FR6 Rename and delete chats.**
- **FR7 Error handling:** ... A failed request must never lose the user's message.

### 5. Data Model
Chat { id (uuid), title, createdAt, updatedAt, model }; Message { id, chatId, role 'user'|'assistant', content, createdAt, status 'sent'|'pending'|'error' }.
SQLite tables `chats` and `messages`, with an index on `messages.chatId`. Deleting a chat cascades to its messages.

### 2. Tech Stack
- Navigation: React Navigation (a drawer or stack holding the chat list and the chat screen)
- Local persistence: expo-sqlite (preferred)

### 10. Acceptance Criteria (S02-relevant)
- A user can create 3 chats, send messages in each, kill the app, reopen it and see all 3 chats with their full history intact
- The same follow-up question in a different chat does not know about the other chat
- Deleting a chat removes it and all its messages

## Clarifications (PO, 2026-11-03)
1. Layout: **drawer** (ChatGPT style). The chat list lives in a side drawer, opened with the ☰ button or an edge swipe; the chat fills the main screen.
2. Rename and Delete: **long-press menu** on a chat in the drawer (native action sheet).
3. Last-updated time: **absolute**. A time today, otherwise a date, following the device locale.
4. Launch: a **new empty chat with the drawer closed**. If there are no saved chats, the drawer shows the empty state.
5. Titles: first ~40 characters of the first prompt (decided in S01); no LLM call.
