---
name: feedback
description: Turn business or code-review feedback on an open PR into a new round of tasks for the React Native agent team and update the same PR.
argument-hint: <PR number> [extra feedback text]
disable-model-invocation: true
---

Feedback round for an existing PR. Input:

$ARGUMENTS

1. Identify the PR number from the input. Fetch its context:
   - `gh pr view <n> --json number,title,headRefName,body,reviews,comments`
   - `gh api repos/{owner}/{repo}/pulls/<n>/comments` for inline review comments (file + line)
2. `git fetch origin && git checkout <headRefName> && git pull`.
3. Append everything (PR comments + any text I gave above) to the sprint's `requirements.md` under `## Feedback round N`, quoting each point with its author.
4. Classify each point: code change, test change, requirement change, or question. Questions and requirement changes come back to me first in one batch. Don't guess.
5. Update `stories.md` if behaviour changes (new or edited ACs, marked `(round N)`).
6. Create tasks: `[DEV-n]` / `[QA-n]` for each change, a new `[QA] Sign-off (round N)` blocked by all of them, and `[SM] Update PR (round N)` blocked by the sign-off.
7. Spawn `dev` (rn-dev) and `qa` (qa-engineer) if they aren't running, with spawn prompts that list the feedback points and the PR branch. QA must re-run the full Maestro regression on every available platform, not only the changed parts.
8. After PASS: push to the same branch (the PR updates itself), update the PR body's QA section with `gh pr edit <n> --body-file …`, and tell me what changed. Ask me before posting any PR comment or resolving review threads.
