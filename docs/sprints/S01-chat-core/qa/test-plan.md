# S01-chat-core: QA test plan

Gate: Jest (unit gate) for every AC. Maestro only for the core path, run against `LLM_PROVIDER=fake`. Device runs only on a connected physical phone.

## AC map
| AC | Jest test expected | Maestro flow | Status |
|---|---|---|---|
| AC-1 | verify_unit_tests.sh passes | - | todo |
| AC-2 | grep check (nectar/grocer) + app.json id/name test or script | - | todo |
| AC-3 | chat screen: empty state "Ask anything" | chat_send_receive | todo |
| AC-4 | server: GET /health 200 {ok:true}; listens 0.0.0.0:8787 | - | todo |
| AC-5 | server: /api/chat passes system + messages in order, returns {content} (mocked SDK) | chat_send_receive | todo |
| AC-6 | server: each code mapping (401/403 auth, 429, 529/5xx, timeout, network, refusal, 400/invalid body); no key/content in response or logs | chat_error_retry | todo |
| AC-7 | server: no network in tests; .env gitignored, .env.example has names only | - | todo |
| AC-7a | server: fake mode no key, echo + earlier user messages, `[fail:<code>]` | all flows | todo |
| AC-8 | provider: posts to `${EXPO_PUBLIC_API_URL}/api/chat`, default localhost:8787 | - | todo |
| AC-9 | provider: ChatError code + exact user message per code; non-JSON, fetch failure, timeout, abort | - | todo |
| AC-10 | screen: order and alignment (user right / assistant left) | chat_send_receive | todo |
| AC-11 | screen: Send disabled when empty/whitespace/in flight; enabled otherwise | chat_send_receive | todo |
| AC-12 | screen: message shown at once, input cleared, typing indicator until reply/fail | chat_send_receive | todo |
| AC-13 | screen: markdown headings, lists, bold, inline code, fenced code (monospace, horizontal scroll) | - | todo |
| AC-14 | screen: scrollToEnd on new message / indicator | - | todo |
| AC-15 | screen: long-press copies text (Clipboard mock called) + "Copied" shown, for user and assistant | - | todo |
| AC-16 | slice+screen: failed msg stays with status error, inline error text, Retry resends same history, error disappears, Send re-enabled | chat_error_retry | todo |
| AC-17 | screen/provider: offline fetch reject shows offline text, no crash | - | todo |
| AC-18 | screen: KeyboardAvoidingView (Platform.OS branches ios/android), input visible | - | todo |
| AC-19 | slice+screen: New chat clears, empty state shows | chat_new_chat | todo |
| AC-20 | slice: payload = system + all sent msgs oldest-first + new; no typing/failed duplicates | chat_followup_context | todo |
| AC-21 | slice: second request includes earlier question | chat_followup_context | todo |
| AC-22 | slice: after New chat, request has no previous messages | chat_new_chat | todo |

## testID contract (convention chat_<element>)
| testID | Element |
|---|---|
| chat_screen | screen root |
| chat_header_title | "Parley" title |
| chat_new_chat_btn | New chat header button |
| chat_empty_state | "Ask anything" placeholder |
| chat_list | message FlatList |
| chat_message_<id> | message row (user and assistant); also long-press target |
| chat_message_text_<id> | optional: message text |
| chat_input | multiline TextInput |
| chat_send_btn | Send button (accessibilityState.disabled reflects state) |
| chat_typing_indicator | typing indicator |
| chat_error | inline error container |
| chat_error_text | error message text |
| chat_retry_btn | Retry button |
| chat_copied_toast | "Copied" confirmation |

Each interactive element also needs an accessibilityLabel. Ids for rows: dev may use stable ids; if ids are random, flows match by text, so also expose `chat_message_user` / `chat_message_assistant` roles via testID only if cheap (otherwise text matching is used).

## Risks dev's tests must cover
- Error, empty, loading states; every error code mapped to its exact text.
- Retry never loses the message; retry sends identical history (no duplicate of the failed attempt).
- Offline: fetch rejects, no unhandled promise rejection.
- Abort signal gives a ChatError, not a crash.
- History building: typing indicator and error-status messages excluded; order preserved; New chat resets.
- No key leaks: server responses and logs contain no key or message content; no key in app bundle or env (only EXPO_PUBLIC_API_URL).
- Keyboard over input: Platform.OS branches tested (ios padding vs android behavior).
- Small screens: long code block scrolls horizontally, long text wraps.
- Double-tap Send in flight does not send twice.
- Refusal (`stop_reason: refusal`) shows friendly text.

## Flows (Maestro, fake provider)
- `chat_send_receive` (smoke): empty state, send, reply echo. AC-3, 10-12.
- `chat_followup_context`: two messages, second reply lists the first. AC-20, 21.
- `chat_error_retry`: send `[fail:rate_limit]`, see error + Retry, tap Retry. AC-16. (Fake fails again deterministically; the flow asserts error persists then Send is enabled. Retry-success needs a fake that succeeds second time; open question for dev.)
- `chat_new_chat`: tap New chat, empty state, ask again, reply has no earlier messages. AC-19, 22.

Run setup: `LLM_PROVIDER=fake npm run server`; app with `EXPO_PUBLIC_API_URL=http://<Mac LAN IP>:8787`.
