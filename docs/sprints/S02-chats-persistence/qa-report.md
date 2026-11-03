# QA Report: S02-chats-persistence
**Verdict:** PASS
Commit: 11d3a62 (app code unchanged since fbf43ca; ff61376 is test-only)

## Unit gate
typecheck ✓ lint ✓ format ✓  Jest 164/164, line coverage 94.1%

## AC coverage
Every AC-1..AC-20 has at least one named Jest test (db/memory/sqlite repos, multiChat, title, format, ChatDrawerContent, ChatScreen, index, layout). Flows: chats_persistence (AC-1, 2, 6, 8, 9, 13), chats_drawer_switch (AC-7, 9, 10, 11, 12, 19), chats_rename (AC-14, 15, 16), chats_delete (AC-15, 17, 18), plus the 4 S01 flows.
| AC | Device result |
|---|---|
| AC-2 persistence after real kill/relaunch | pass (chats_persistence) |
| AC-12 Android back closes drawer | pass (chats_drawer_switch, Android step) |
| AC-7 time format | "10:20 PM" shown, matches device locale (en-US, 12h); date form covered by Jest only |
| AC-4, AC-5, AC-20 | Jest only (not exercised on device) |

## Device regression
| Platform | Device | OS | Flows | Crashes |
|---|---|---|---|---|
| Android phone | Samsung SM-S938W (R3CY509CB6D), release build, fake LLM provider | Android (as installed) | 8/8 | 0 |
| iPhone | none | - | not run: no device connected | - |

## Bugs
Found 1 / fixed 1 / open 0. BUG-1 Low (test gap: Drawer layout config), fixed in ff61376.
Flow-only fixes (not app bugs): text selectors matched the chat bubble behind the drawer scrim and the preview text, so rename/delete flows now select rows by drawer_chat_title_* id.

## Risks / known limitations / not tested
- Edge swipe to open the drawer is not verified on device: on this phone a swipe from the left edge triggers the system back gesture. The hamburger path is verified; the swipe config is asserted in Jest only.
- iOS not tested at all. Date (non-today) display, pending-to-error on a real kill mid-reply, and in-flight switching on device were not exercised (Jest only).
- One unexplained intermediate flow result: a text-based tap on the renamed row once opened a new chat; the id-based tap passes repeatedly. Not reproduced in the app with the id selector.
- Proxy ran with LLM_PROVIDER=fake only; stopped after the run.
