# S02-chats-persistence: task board

Branch `feature/S02-chats-persistence` (from `main` after PR #1). Statuses: todo · in-progress · ready-for-test · done. Lead keeps this file and Trello in sync.

| ID | Title | Owner | ACs | Depends on | Status |
|---|---|---|---|---|---|
| DEV-1 | Persistence layer: expo-sqlite schema v1 (chats, messages, FKs + cascade, indexes, user_version), repository interface + SQLite implementation + in-memory fake for Jest, pending → error on startup | dev | AC-1 (storage), AC-3, AC-4, AC-5, AC-18 (cascade) | — | ready-for-test (567efdf) |
| DEV-2 | Redux multi-chat: chats slice (list, active chat, unsaved new chat), per-chat messages loaded on open, write-through thunks, auto title helper, rename/delete thunks, in-flight replies routed to their own chat | dev | AC-1, AC-2, AC-10, AC-11, AC-13, AC-14, AC-19, AC-20 | DEV-1 | ready-for-test (2621d9d) |
| DEV-3 | Drawer navigation: expo-router Drawer (+ gesture-handler, reanimated), header with ☰ / title / New chat, launch on a new empty chat, Android back closes the drawer | dev | AC-6, AC-12 | DEV-2 | ready-for-test (fbd3656) |
| DEV-4 | Drawer content: New chat button, chat list (FlatList, newest first, title / plain-text preview / absolute locale time, active highlight), empty state, open chat on tap | dev | AC-7, AC-8, AC-9, AC-10, AC-11 | DEV-3 | ready-for-test (024a29f) |
| DEV-5 | Long-press menu (Rename / Delete / Cancel), rename dialog (prefilled, trimmed, non-empty, max 60), delete confirmation; deleting the open chat → new chat | dev | AC-15, AC-16, AC-17, AC-18 | DEV-4 | ready-for-test (d5ba2e5) |
| QA-1 | Test plan + testID contract | qa | all | — | done |
| QA-2 | Maestro flows: multi-chat persistence across restart (AC-2), drawer switch + isolation, rename, delete, plus the S01 regression flows | qa | AC-2, AC-6 – AC-11, AC-15 – AC-19 | QA-1 | todo |
| QA | Sign-off | qa | all | every DEV / QA / BUG | todo |
| SM | Open PR | lead | — | QA Sign-off | todo |
