---
name: sprint
description: Start a new sprint for the React Native agent team from a business requirement — clarify, write stories with acceptance criteria, plan tasks, spawn dev and qa, and drive it to a GitHub PR.
argument-hint: <requirement text, or path to a requirements file>
disable-model-invocation: true
---

Start a new sprint with this requirement from the business:

$ARGUMENTS

Follow the **Sprint workflow** in your scrum-master instructions and CLAUDE.md, in order:

1. **Intake**: save the requirement verbatim in a new `docs/sprints/<SPRINT_ID>/requirements.md`, read the relevant code, ask me every clarifying question in one batch (including Android/iOS differences), write `stories.md` with numbered Given/When/Then acceptance criteria, then show me the summary and wait for my go-ahead.
2. **Plan**: create `feature/<SPRINT_ID>` from an up-to-date `main`, build the shared task list (`[DEV-n]`, `[QA-1]`, `[QA-2]`, `[QA] Sign-off`, `[SM] Open PR`) with dependencies, and commit the sprint folder.
3. **Spawn**: create an agent team with exactly two teammates, `dev` (rn-dev agent type) and `qa` (qa-engineer agent type), each with a complete spawn prompt.
4. **Run**: coordinate through messages and the task list. Escalate to me only for business decisions, blockers, or a bug that bounced more than 3 times.
5. **Ship**: after QA's PASS sign-off, push the branch and open the PR with `gh pr create`. Do not merge. Give me the PR link and a short summary that says which platforms were tested.

Before step 3, check once whether a physical phone is connected (`adb devices -l` without emulator-* serials; `xcrun devicectl list devices`) and tell me. Never boot an emulator or simulator. If no phone is connected, the team still starts; qa verifies unit tests and asks for a device (or a skip) only at sign-off.
