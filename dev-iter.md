# /dev iteration — Single Agent Invocation

You are spawned by the orchestrator via `claude -p` to execute ONE iteration. Do one task, exit.

## Project Context

- **Working directory**: `/root/work/brpc`
- **Issue repo**: `Mouriya-Emma/moat-browser`
- **Loop workflow**: Follow `/root/work/brpc/CLAUDE.md` Steps 0–8 exactly.

**Before exiting for ANY reason, you MUST print a one-line summary of what happened and why you are exiting.** The review agent has no other way to know what occurred. No silent exits.

---

## Step 0: Preflight Checks

Before doing ANY work, verify preconditions. If any FAIL, print what failed and exit.

### Environment

| Check | How | If fails |
|---|---|---|
| gh authenticated | `gh auth status` | → exit |
| GitHub API reachable | `gh api rate_limit --jq .rate.remaining` | → exit |
| API rate limit > 50 | same | → exit |

### Per-repo

| Check | How | If fails | Repair |
|---|---|---|---|
| Git repo | `git rev-parse --git-dir` | → exit | — |
| No stale lock | `find .git/index.lock -mmin +5 2>/dev/null` | If found → remove | If fresh (<5min) → exit |
| Not detached HEAD | `git symbolic-ref HEAD` | `git checkout $DEFAULT` | If fails → exit |
| Clean worktree | `git status --porcelain` | `git stash` | If fails → exit |
| main up to date | `git fetch && rev-list` | `git pull --ff-only` | — |
| CLAUDE.md exists | `test -f CLAUDE.md` | → exit | — |
| Design doc accessible | Read from CLAUDE.md | → exit | — |
| Verify commands exist | Check binary in PATH | → exit | — |

### Issues

| Check | How | If fails |
|---|---|---|
| Open issues exist | `gh issue list --state open --limit 1` | → exit |
| At least one actionable | Exclude blocked/review/design-question | → exit |
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

3. Standalone issue with dependencies met.

4. Nothing actionable → print "No actionable issue found" and exit.
```

---

## Step 2: Read Issue + Dependency Chain

**CRITICAL: You must read comments AND the full dependency chain.**

### 2a: Read current issue

```bash
gh issue view $ISSUE -R "$ISSUE_REPO" --json body,title,labels,comments
```

**If there are review feedback comments**, they contain:
- What was done wrong in the previous iteration
- Required changes (specific instructions)
- Design references
- Constraints (what NOT to do)

**Follow the most recent review feedback.** It is your primary guidance for this iteration.

### 2b: Read dependency chain (recursive)

Extract `Depends on:` entries from the issue body. For each dependency, read its body + comments + linked PR. Then read THAT issue's dependencies, recursively, until there are no more upstream issues.

```bash
# For each dependency issue:
gh issue view $DEP_ISSUE -R "$ISSUE_REPO" --json body,comments,state
# Find linked PRs:
gh pr list -R "$TARGET_REPO" --search "$DEP_ISSUE" --state merged --json number,body --limit 3
```

**Extract constraints and findings from the entire chain.** Any upstream issue or PR may contain discoveries that override or constrain your current task. Examples:
- A spike proved a runtime incompatibility (e.g. "Bun WebSocket doesn't work, use Node.js")
- An earlier phase found a workaround (e.g. "Chrome ignores --remote-debugging-address, use socat")
- A review comment added a requirement not in the original issue body

**If an upstream finding contradicts your current issue's Technical Approach or Acceptance Criteria, the upstream finding wins.** Adapt your implementation accordingly and note the deviation in your PR.

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

### 5a: CLAUDE.md verify commands

Run ALL verify commands from THIS REPO'S CLAUDE.md, in order:

1. typecheck (if available)
2. lint (if available)
3. test (required)
4. build (if available)

If fails: fix (max 3 attempts). Still failing → print the exact error and exit.

**Do NOT modify test files to make tests pass. Fix the code.**

### 5b: Issue checkpoint commands

If the issue has an **Acceptance Criteria** table with checkpoint rows, execute each checkpoint command in order. For checkpoints with `Env: VM` or other remote environments, use SSH or the appropriate access method.

```
For each row in the Acceptance Criteria table:
  1. Run the Command in the specified Env
  2. Compare output against Expect
  3. Print: "Checkpoint #N (<dimension>): PASS" or "Checkpoint #N (<dimension>): FAIL — <actual output>"
```

If a checkpoint fails: fix (max 3 attempts per checkpoint). Still failing → print which checkpoint failed with the actual output, and continue to the next checkpoint. Do NOT skip checkpoints silently.

If the issue has an **Inherited Verification Obligations** table, execute those the same way. These are checkpoints deferred from earlier Phases — they MUST be executed, not deferred again.

After all checkpoints, print a summary: "Checkpoints: X/Y passed (dimensions: function N/M, environment N/M, integration N/M, assumption N/M)".

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

---

## Cross-Repo Rules

- Each iteration = one repo
- CLAUDE.md from TARGET repo
- Commit refs: `owner/repo#N` for cross-repo
- PR in code repo, issue in issue repo
