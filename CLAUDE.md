# Team Charter — React Native Agent Team

> Every agent (Scrum Master, RN Dev, QA) loads this file. It is the team's shared contract.
> If this repo already has a CLAUDE.md, append this section to it instead of replacing it.

## Project context
- App: `Parley`, an LLM chat app (like the ChatGPT / Claude apps). React Native via Expo SDK 58 (managed; dev build when native modules need it), TypeScript, expo-router (built on React Navigation)
- Android applicationId / iOS bundle id: `com.ahmedmu.parley` (scripts auto-detect both; override with `ANDROID_APP_ID` / `IOS_BUNDLE_ID` env)
- Package manager: `npm`
- Backend: local TypeScript/Express proxy in `server/` (owned by dev). It holds `ANTHROPIC_API_KEY` in the gitignored `server/.env`, which the PO fills in. The key never goes in the app bundle, tests or commits. Tests use a fake provider.
- Design source: none. Clean, minimal chat UI defined in `docs/sprints/S01-chat-core/stories.md` (UI direction)
- Trello board (PO view): https://trello.com/b/FAcvrgJn; synced by lead only
- Default branch: `main`

## The team
| Name (in messages) | Agent type     | Owns                                                                                   |
|--------------------|----------------|----------------------------------------------------------------------------------------|
| `lead`             | `scrum-master` | `docs/sprints/**`, the task list, git push, the PR                                     |
| `dev`              | `rn-dev`       | `src/**`, `app/**`, `server/**`, `__tests__/**`, `*.test.ts(x)`, `package.json` + lockfile, `ios/**`, `android/**`, `app.json`/`app.config.*`, `assets/**` |
| `qa`               | `qa-engineer`  | `.maestro/**`, `docs/sprints/<id>/qa/**`, `qa-report.md`                               |

**Never edit a file you don't own.** Need a change in someone else's area? Send them a message.
The human (Ahmed) is the Product Owner and the final code reviewer. Only the human merges.

## Sprint folder layout
```
docs/sprints/<SPRINT_ID>/          e.g. docs/sprints/S03-leave-balance/
  requirements.md   raw input from business (verbatim) + clarifications
  stories.md        user stories with numbered acceptance criteria (AC-1, AC-2 …)
  qa/test-plan.md   QA's mapping of every AC → test(s) + the testID contract
  qa/bugs.md        bug log
  qa/evidence/      screenshots, regression summaries, logs (per platform)
  qa-report.md      final QA report with **Verdict:** PASS | FAIL
```

## Task naming (shared task list)
- `[DEV-n] <title>` — implementation task (owner: dev)
- `[QA-n] <title>` — test plan / E2E flows / verification (owner: qa)
- `[BUG-n] <title>` — defect found by QA (owner: dev)
- `[QA] Sign-off` — final verification, blocked by every DEV, QA and BUG task
- `[SM] Open PR` — blocked by `[QA] Sign-off`

A hook enforces gates: `[DEV-*]`/`[BUG-*]` can't be completed unless typecheck + lint + format check + Jest pass;
`[QA] Sign-off` and `[SM] Open PR` / `Update PR` can't be completed without a qa-report.md saying `**Verdict:** PASS`.

## Git rules
- One feature branch per sprint: `feature/<SPRINT_ID>`, created by lead from an up-to-date `main`.
- Everyone commits to that branch, only their own files. Conventional commits with the task id:
  `feat(DEV-2): add leave balance card`, `fix(BUG-1): handle null balance`, `test(QA-2): e2e flow for leave request`
- Never commit to `main`, never force-push, never rewrite history, never merge PRs.
- Only lead pushes and opens the PR.

## Message protocol (SendMessage)
Keep messages short and structured. Start with a tag:
- `READY FOR TEST` — dev → qa: task ids, commit sha, what changed, how to reach the screen, testIDs added, platform notes, whether native deps changed (needs `pod install` / rebuild)
- `BUG` — qa → dev: bug id, platform + emulator/simulator, steps, expected vs actual, evidence path, severity
- `FIXED` — dev → qa: bug id, commit sha, root cause in one line
- `NEED` — anyone → owner: a change needed in the owner's files (e.g. "add testID='leave_submit_btn'")
- `BLOCKED` — anyone → lead: what is blocking and what you need
- `QUESTION` — anyone → lead: requirement ambiguity. Lead answers or escalates to the human. Never guess business rules.
- `SIGN-OFF` — qa → lead: verdict + report path + platforms tested

## Testability contract (dev ⇄ qa)
- Every interactive element and every element an AC talks about gets a stable `testID="<feature>_<element>"`.
  Maestro finds it with `id: "<feature>_<element>"` on both Android and iOS.
- Interactive elements also get an `accessibilityLabel` (good for users and a fallback selector).
- Lists: `testID` on the list and `` `${feature}_item_${id}` `` on rows.
- QA publishes the testIDs it needs in `qa/test-plan.md` early; dev adds them.

## Platforms for QA
- **Unit tests are the main gate.** QA verifies that dev's Jest / React Native Testing Library tests pass and cover every AC.
- **Device regression (Maestro) runs only on a physical phone that is already connected** (Android via `adb`, iPhone via `xcrun devicectl` if Maestro and signing support it). QA checks once at sign-off and never boots or creates an emulator or simulator, to save machine memory and tokens.
- No device connected: QA asks lead once (`NEED DEVICE`). Lead asks the human to connect one or to skip. If skipped, sign-off is based on the unit gate and the report says "Device regression: not run".
- The sign-off report lists exactly what was tested on a device; an untested platform is called out, never implied.

## Definition of Done (a story is done when)
1. Every AC is implemented and covered by at least one Jest / React Native Testing Library test (dev). Core user paths also have a Maestro flow (qa).
2. Typecheck, lint, format check and Jest all clean.
3. QA has verified dev's tests (every AC has a test that checks what the user sees).
4. Maestro regression passes on every connected physical device, or device regression was explicitly skipped by the human (noted in the report).
5. No open BUG tasks of severity High/Critical.
6. qa-report.md written with `**Verdict:** PASS`.

## Hard rules
- No secrets, keys or real user data in code, tests, flows or commits.
- Don't add packages without stating why in the commit message; prefer what's already in package.json. Flag native-module additions in `READY FOR TEST` (they need a rebuild / `pod install`).
- Don't upgrade React Native, Expo SDK or major dependencies inside a feature sprint.
