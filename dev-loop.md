# /dev iteration — Single Agent Invocation

You are spawned by the orchestrator via `claude -p` to execute ONE iteration. Do one task, return a JSON result, exit.

---

## Output Contract

Your last line MUST be exactly one JSON object:

```
{"_tag": "pr_created", "issue": N, "repo": "owner/repo", "pr": N, "branch": "..."}
{"_tag": "completed", "issue": N, "repo": "owner/repo", "pr": N}
{"_tag": "blocked", "issue": N, "reason": "..."}
{"_tag": "no_actionable_issue"}
{"_tag": "split", "parent": N, "children": [N, ...]}
{"_tag": "wip", "issue": N, "repo": "owner/repo", "branch": "...", "progress": "..."}
{"_tag": "error", "message": "..."}
```

---

## Step 0: Preflight Checks

Before doing ANY work, verify preconditions. If any FAIL, return `error`.

### Environment

| Check | How | If fails |
|---|---|---|
| gh authenticated | `gh auth status` | → error |
| GitHub API reachable | `gh api rate_limit --jq .rate.remaining` | → error |
| API rate limit > 50 | same | → error |

### Per-repo

| Check | How | If fails | Repair |
|---|---|---|---|
| Git repo | `git rev-parse --git-dir` | → error | — |
| No stale lock | `ls .git/index.lock` | If >5min → remove | If fresh → error |
| Not detached HEAD | `git symbolic-ref HEAD` | `git checkout $DEFAULT` | If fails → error |
| Clean worktree | `git status --porcelain` | `git stash` | If fails → error |
| main up to date | `git fetch && rev-list` | `git pull --ff-only` | — |
| CLAUDE.md exists | `test -f CLAUDE.md` | → error | — |
| Design doc accessible | Read from CLAUDE.md | → error | — |
| Verify commands exist | Check binary in PATH | → error | — |

### Issues

| Check | How | If fails |
|---|---|---|
| Open issues exist | `gh issue list --state open --limit 1` | → no_actionable_issue |
| At least one actionable | Exclude blocked/review/design-question | → no_actionable_issue |
| No orphaned in-progress | Stale in-progress labels | Remove label (repair) |

---

## Step 1: Select Task

Priority queue:

```
1. Issue labeled "in-progress" with existing branch/PR
   → This is a RETRY from the review agent. Read issue comments for guidance.
   → Resume and follow the review feedback.

2. Parent issue with open sub-issues
   → Smallest-number open sub-issue with dependencies met.

3. Standalone issue with dependencies met
   → Evaluate splitting. If needed → return split.

4. Nothing actionable → return no_actionable_issue.
```

---

## Step 2: Read Issue — MUST INCLUDE COMMENTS

**CRITICAL: When reading an issue, you MUST read the comments too.**

The review agent posts guidance as issue comments. If you don't read them, you will repeat the same mistakes and get rejected again.

```bash
# Read issue body AND all comments
gh issue view $ISSUE -R "$ISSUE_REPO" --json body,title,labels,comments --jq '{
  title: .title,
  labels: [.labels[].name],
  body: .body,
  comments: [.comments[] | {author: .author.login, body: .body, createdAt: .createdAt}]
}'
```

**If there are review feedback comments**, they contain:
- What was done wrong in the previous iteration
- Required changes (specific instructions)
- Design references
- Constraints (what NOT to do)

**Follow the most recent review feedback.** It is your primary guidance for this iteration.

---

## Step 3: Determine Repo & Switch

Extract `Repo:` and `path:` from issue body's Context section.

Switch to target repo. Read THAT repo's CLAUDE.md.

---

## Step 4: Implement

```bash
# Claim (if not already in-progress)
gh issue edit $ISSUE -R "$ISSUE_REPO" --add-label "in-progress"

# Branch
git checkout $DEFAULT_BRANCH && git pull
BRANCH="phase-$ISSUE"
git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH"
```

If this is a RETRY (issue has review feedback comments):
- Read the review feedback carefully
- Address EVERY point in the feedback
- If the feedback says "redo following design section X" → read that section, implement exactly as specified

If this is a NEW task:
- Read issue body for requirements
- Read design doc for approach
- Follow CLAUDE.md conventions

One issue = one deliverable.

---

## Step 5: Verify

Run ALL verify commands from THIS REPO'S CLAUDE.md, in order:

1. typecheck (if available)
2. lint (if available)
3. test (required)
4. build (if available)

If fails: fix (max 3 attempts). Still failing → return blocked with specific error.

**Do NOT modify test files to make tests pass. Fix the code.**

---

## Step 6: Commit & PR

```bash
git add <specific files>   # NEVER git add -A
git commit -m "feat(phase-$ISSUE): <description>

Refs: $ISSUE_REPO_FULL#$ISSUE"
git push origin $BRANCH
```

If PR already exists (retry scenario):
- Just push to the same branch. PR updates automatically.
- Return `pr_created` with the existing PR number.

If no PR yet:
```bash
gh pr create -R "$TARGET_REPO" \
  --title "Phase $ISSUE: <title>" \
  --base $DEFAULT_BRANCH \
  --body "Closes $ISSUE_REPO_FULL#$ISSUE ..."
```

Record progress:
```bash
gh issue comment $ISSUE -R "$ISSUE_REPO" --body "Iteration update: PR $TARGET_REPO#$PR — <what was done>"
```

Return `pr_created`.

---

## Cross-Repo Rules

- Each iteration = one repo
- CLAUDE.md from TARGET repo
- Commit refs: `owner/repo#N` for cross-repo
- PR in code repo, issue in issue repo
