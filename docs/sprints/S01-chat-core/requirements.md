# S01-chat-core: requirements

Source: `REQUIREMENTS.md` from the PO (2026-11-03), copied verbatim below. PO notes: "use any name and for the UI I don't have something specific you can do whatever". GitHub repo: https://github.com/ahmedmu-dev/chatbot.git

---

# Chat App: Requirements

## 1. Overview
A simple mobile chat app built in React Native, similar to the ChatGPT or Claude apps. The user starts chats, sends prompts to an LLM (Claude, OpenAI, or another provider) and sees the responses. The user can keep several chats, and each chat saves its own history.

## 2. Tech Stack
- React Native with Expo, in TypeScript
- Navigation: React Navigation (a drawer or stack holding the chat list and the chat screen)
- State: Zustand, or React Context
- Local persistence: expo-sqlite (preferred) or AsyncStorage
- LLM access: a provider abstraction (see §6), with Anthropic as the default
- Markdown rendering for responses: react-native-markdown-display or similar

## 3. Screens

### 3.1 Chat List (Home)
- Lists all chats, newest first, showing each chat's title, last-message preview and last-updated time
- A "New Chat" button
- Tapping a chat opens it
- Long-press or swipe on a chat offers Rename and Delete (Delete asks for confirmation)
- An empty state appears when there are no chats

### 3.2 Chat Screen
- A scrollable message list with user messages on the right and assistant messages on the left
- A multiline text input with a Send button that is disabled while the input is empty or a request is in flight
- A "typing" or loading indicator while the response is pending
- Assistant responses render as Markdown, including code blocks
- Auto-scroll to the newest message
- Long-press on a message to copy its text
- If a request fails, show an inline error with a Retry button
- (Nice to have) Stream the response token by token
- (Nice to have) A Stop button to cancel generation

### 3.3 Settings (minimal)
- Choose the provider and model
- (Nice to have) Clear all chats

## 4. Functional Requirements
- **FR1 New chat:** Create an empty chat. The chat is persisted only once its first message is sent.
- **FR2 Send prompt:** Append the user message, call the LLM with the chat's full history (see §7), then append and display the assistant response.
- **FR3 Multiple chats:** The user can switch between chats freely. Each chat is fully independent.
- **FR4 History persistence:** All chats and messages survive an app restart.
- **FR5 Auto title:** After the first exchange, generate a short title. Use either the first ~40 characters of the user's prompt or a cheap LLM call that asks for a 3–5 word title.
- **FR6 Rename and delete chats.**
- **FR7 Error handling:** Handle network errors, rate limits (429), auth errors and timeouts with a user-friendly message and a retry option. A failed request must never lose the user's message.

## 5. Data Model
```ts
type Chat = {
  id: string;           // uuid
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;        // model used for this chat
};

type Message = {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  status: 'sent' | 'pending' | 'error';
};
```
SQLite tables `chats` and `messages`, with an index on `messages.chatId`. Deleting a chat cascades to its messages.

## 6. LLM Integration
- Define a `ChatProvider` interface:
  `sendMessage(messages: {role, content}[], options) => Promise<string>`, plus an optional streaming variant
- Implement `AnthropicProvider` first (Messages API). `OpenAIProvider` is optional.
- Keep a configurable system prompt. Default: "You are a helpful assistant."
- **Security:** Do NOT ship the API key inside the app bundle. Route calls through a small backend proxy that holds the key, such as a Cloudflare Worker, a Vercel function or an Express server. For local development only, the key may come from an env var.

## 7. Context Handling
- On every request, send the system prompt plus the full message history of the current chat, ordered oldest to newest
- Never send messages from other chats
- Context limit: if the history exceeds a token budget (configurable, e.g. ~80% of the model's window), drop the oldest messages first while always keeping the system prompt and the latest user message
- (Later) Summarize old messages instead of dropping them

## 8. Non-Functional
- Works on iOS and Android
- Supports light and dark mode
- The chat list loads in under 500 ms with 100+ chats
- The input stays usable with the keyboard open (KeyboardAvoidingView)
- No crashes when offline; show an offline error instead

## 9. Out of Scope (v1)
User accounts or login, cloud sync, file and image uploads, voice, cross-chat memory, and HR actions (see v2 below).

## 10. Acceptance Criteria
- A user can create 3 chats, send messages in each, kill the app, reopen it and see all 3 chats with their full history intact
- Asking a follow-up question ("what did I just ask?") works inside a chat
- The same follow-up question in a different chat does not know about the other chat
- Deleting a chat removes it and all its messages

---

# v2: HR Actions via Tool Use and MCP

## 11. Goal
The chatbot can perform real actions on the HR server for the logged-in user, such as applying for leave or submitting an attendance justification, from natural-language prompts. Example: "I need sick leave tomorrow" results in a submitted leave request.

## 12. Architecture
```
RN App ──► Chat Backend (LLM calls + MCP client + tool loop) ──► LLM API
                     │
                     └──► HR MCP Server ──► HR REST API
```
- The RN app never calls the LLM or the MCP server directly. All calls go through the Chat Backend.
- **Chat Backend** (Node/TS): holds the LLM API key, connects to the HR MCP server as an MCP client, runs the tool-use loop and streams results to the app.
- **HR MCP Server** (TypeScript MCP SDK): wraps the existing HR REST API as MCP tools. It contains no business logic, so the HR API remains the source of truth for validation.
- Alternative to evaluate: Anthropic API's remote MCP connector, which lets the API connect to the MCP server and run the loop itself. If adopted, the backend still owns auth and confirmation.

## 13. MCP Tools
| Tool | Type | Description |
|---|---|---|
| `get_leave_types` | read | Available leave types for the user |
| `get_leave_balance` | read | Remaining balance per leave type |
| `get_my_leaves` | read | User's leave requests and their statuses (filter by date/status) |
| `apply_leave` | **write** | `leave_type, start_date, end_date, reason?, attachment_url?` |
| `cancel_leave` | **write** | `leave_id` |
| `get_attendance` | read | Attendance records for a date range, including missing/late punches |
| `submit_attendance_justification` | **write** | `date, justification_type, reason` |
| `get_justification_types` | read | Allowed justification types |

- Each tool has a clear description and a strict JSON input schema (enums for types, ISO dates).
- Tools return structured JSON: on success `{ok: true, data}`, on failure `{ok: false, error: {code, message}}`. The model uses error messages to explain failures to the user.

## 14. Tool-Use Loop (Chat Backend)
1. Load the chat history, the system prompt and the tool list (fetched from the MCP server via `tools/list`, then cached).
2. Call the LLM with the history and the tools.
3. If the response contains `tool_use`:
   - **Read tool:** execute immediately via MCP `tools/call`, append the `tool_result` and go back to step 2.
   - **Write tool:** pause and send a confirmation request to the app (see §15).
4. Once the response is plain text, send it to the app and persist it.
5. Cap the loop at 10 iterations per user message to prevent runaway loops.

System prompt additions: today's date, the user's timezone (Asia/Dubai), and the instruction "Ask the user for missing required details instead of guessing. Never invent IDs."

## 15. Confirmation Flow (write actions)
- The backend sends `{type: "confirm_action", actionId, tool, args, summary}` to the app.
- The app renders an **action card** inside the chat, e.g. "Apply **Sick leave**, Nov 4 → Nov 4", with **Confirm** and **Cancel** buttons.
- Confirm: the backend executes the tool, returns the result to the model, and the model replies with the outcome.
- Cancel: the backend returns `tool_result: "User cancelled"` to the model, and the model acknowledges.
- Action cards are persisted as messages, so they show in history with their final state (confirmed / cancelled / failed).
- Extend the `Message` model:
  ```ts
  role: 'user' | 'assistant' | 'action';
  action?: { tool: string; args: object; status: 'pending' | 'confirmed' | 'cancelled' | 'failed'; result?: object };
  ```

## 16. Auth and Security
- The user logs in to the RN app with existing HR credentials, and the app holds the user's HR access token.
- The app sends the token to the Chat Backend, which forwards it to the MCP server, which calls the HR API with it. All actions therefore run as that user, with that user's permissions.
- The model never receives the token and never chooses the user identity. No tool has a `user_id` parameter.
- The HR API validates every request (dates, balances, overlaps, permissions) exactly as it would for any client.
- All tool calls are logged: user, tool, args, result and timestamp.

## 17. v2 Acceptance Criteria
- "How many annual leave days do I have?" calls `get_leave_balance` and the answer is correct with no confirmation step.
- "I need sick leave tomorrow" shows a confirmation card with the correct date. Confirming creates the leave on the server, and the new leave is visible in the HR system.
- "Apply for leave" with no dates leads the bot to ask for dates. It doesn't guess.
- Cancelling the card creates nothing on the server.
- "Justify my absence on Monday" checks attendance, asks for the reason, shows a confirmation card, then submits.
- Server-side errors (e.g. insufficient balance) are explained to the user in plain language.

---

## Clarifications (PO, 2026-11-03)
1. Scope: v1 now (3 sprints); v2 (HR via MCP) later, once a real HR API is available.
2. Proxy: local TypeScript/Express server in `server/`. The PO puts `ANTHROPIC_API_KEY` in the gitignored `server/.env`.
3. v1 nice-to-haves: Stop button and Clear all chats. No streaming. Titles use the first ~40 characters of the prompt, with no LLM call.
4. Providers: Anthropic only, behind the `ChatProvider` interface.
5. Name: **Parley** (`com.ahmedmu.parley`). UI: "do whatever". The team defines a clean, minimal style.
6. Teammate models: dev = Sonnet, qa = Sonnet.
7. Sprints: S01 chat core, S02 chats + persistence, S03 settings + polish.
8. **State: Redux** (Redux Toolkit), replacing the Zustand / Context options in §2.
9. QA: unit tests are the main gate. Device regression runs only on a connected physical phone; no emulators or simulators.
