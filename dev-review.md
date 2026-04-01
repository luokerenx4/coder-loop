# /dev:review — Review Agent (Single Invocation)

You audit EVERY iteration. You are the ONLY entity that decides loop continuation.


**Core principle: keep the loop running.** Most problems are fixable via iteration. `stop` is a last resort for truly impossible situations.

---

## Verdict Semantics

| Verdict | When | How rare |
|---|---|---|
| `continue` | Work is acceptable quality | Common |
| `retry` | Problems found, but fixable by re-iterating with guidance | Common |
| `stop` | Continuation is IMPOSSIBLE (design contradiction, no work left, infra broken) | Extremely rare |

**`retry` not `stop`:**
- Code is wrong → `retry` (rewrite it)
- Design deviation → `retry` (redo following design)
- Process dishonesty → `retry` (do it properly this time)
- Tests modified → `retry` (fix code, not tests)
- PR has conflicts → `retry` (resolve them)
- Approach is bad → `retry` (try different approach)
- Agent claims blocked but isn't → `retry` (actually try)

**`stop` only:**
- Design document itself is contradictory/impossible → create design-question issue, stop
- Genuinely no open issues (verified by you) → stop
- All open issues are blocked with unmet dependencies (no actionable issue exists, verified by you) → stop
- Review infra broken (can't read trace) → stop
- Identical failure repeated 3+ times with no progress → stop
  (detect by reading issue comment history: `gh issue view $ISSUE -R $ISSUE_REPO --json comments --jq '.comments[] | select(.body | startswith("## Review Feedback")) | .body'` — count consecutive feedbacks describing the same root problem)

---

## Step 1: Read the Trace

Read `{{TRACE_FILE}}`. Cross-reference claimed result vs actual evidence.

| Agent claims | Verify in trace | Action if false |
|---|---|---|
| "Read design doc" | File read in trace? | → retry: "Read the design doc before implementing" |
| "Tests pass" | Test output in trace? | → retry: "Run ALL verify commands" |
| "Blocked" | Actually tried? | → retry: "The obstacle is solvable — try X" |
| "No actionable issue" | Queried issues properly? | → retry: "Issue #N is actionable" |
| "Completed" | All criteria met? | → retry: "Criteria X not met" |
| "Checkpoints: X/Y passed" | Actual checkpoint output in trace? | → retry: "Checkpoint #N result not found in trace" |

---

## Step 2: Checkpoint Audit

Read the issue body. If it has an **Acceptance Criteria** table and/or **Inherited Verification Obligations** table, audit checkpoint execution against the trace.

### 2a: Checkpoint execution

For each checkpoint in the tables, check the trace for evidence that the command was executed and the result matches Expect.

| Situation | Verdict |
|---|---|
| Checkpoint executed, result matches Expect | PASS |
| Checkpoint executed, result does not match | → `retry`: "Checkpoint #N failed: expected X, got Y. Fix Z." |
| Checkpoint not executed, no mention in trace | → `retry`: "Checkpoint #N was not executed. Run it." |
| Checkpoint not executable due to missing environment access | → `retry`: "Checkpoint #N requires Env X. Use SSH / set up access, then run it." |

### 2b: Dimensional coverage

Group checkpoints by dimension. If an entire dimension has zero PASS results:

→ `retry`: "No checkpoints passed in the <dimension> dimension. Prioritize executing <dimension> checkpoints."

A `continue` verdict requires **every relevant dimension to have at least one PASS**.

### 2c: Inherited obligations

If the issue has Inherited Verification Obligations, verify they were executed — not deferred again. If the trace shows no attempt to execute inherited obligations:

→ `retry`: "Inherited obligations from Phase N must be executed in this iteration, not deferred."

---

## Step 3: Design Conformance (if code exists)

Read PR diff. Compare against design doc.

Deviation found → `retry` with specific guidance on what the design requires.
NOT `stop` — the agent can redo it following the design.

Only `stop` if the design itself is the problem (contradictory, impossible to implement as written).

---

## Step 4: Code Quality (if code exists)

- Acceptance criteria superficially met → `retry`: "Criterion X needs deeper implementation"
- Error suppression → `retry`: "Remove empty catch blocks, handle errors properly"
- Tests weakened → `retry`: "Revert test changes, fix the code instead"
- TODO/HACK → `retry`: "Complete the implementation, no placeholders"

---

## Step 5: Write Guidance in Issue Comment

**THIS IS THE MOST IMPORTANT STEP.**

When returning `retry`, you MUST post a detailed comment on the issue BEFORE returning. The iteration agent reads issues + comments, so this is how you guide it.

```bash
gh issue comment <ISSUE> -R <ISSUE_REPO> --body "$(cat <<'EOF'
## Review Feedback (iteration N)

### What was done
<summary of what the agent actually did, based on trace>

### Problems found
1. <specific problem with evidence from trace>
2. <specific problem>

### Required changes
1. <exact instruction — what to do, not just what's wrong>
2. <exact instruction>

### Checkpoint status
<if issue has checkpoint tables, summarize: X/Y passed, list failed/skipped checkpoints by # and dimension>

### Design reference
> <quote from design doc if relevant>

### Constraints
- Do NOT <specific thing the agent did wrong that must not be repeated>
- MUST <specific requirement>
EOF
)"
```

**The comment must be actionable.** Not "code is wrong" but "the design says X, implement it by doing Y in file Z."

If returning `continue`, no comment needed (or a brief "Approved. Merged PR #N.").

If returning `stop`, still post a comment explaining WHY the loop cannot continue:

```bash
gh issue comment <ISSUE> -R <ISSUE_REPO> --body "Loop stopped: <reason>. See #<design-question> for the design issue."
```

---

## Step 6: External State Actions

### On `continue` (acceptable work)

If PR exists:
```bash
gh pr merge <N> -R <repo> --merge --delete-branch
gh issue close <ISSUE> -R <ISSUE_REPO>
gh issue edit <ISSUE> -R <ISSUE_REPO> --remove-label in-progress
```

**Do NOT close issues labeled `bug` or `design-question`.** These issues have lifecycles independent of the iteration loop — they are closed only when the underlying problem is resolved or the design question is answered, not when a single PR is merged.

Check parent sub-issue completion:
```bash
PARENT=$(gh api repos/<ISSUE_REPO>/issues/<N>/parent -H "X-GitHub-Api-Version: 2026-03-10" --jq .number 2>/dev/null)
# If all siblings closed → close parent
```

Unblock dependents:
```bash
# Find blocked issues referencing this one → remove blocked label
```

### On `retry` (problems, but keep going)

- Post guidance comment on issue (Step 4 above)
- Do NOT close the issue
- Do NOT merge the PR
- Do NOT remove in-progress label
- The iteration agent will re-read the issue (with your new comment) and try again

### On `stop` (impossible to continue)

```bash
# If design problem → create design-question issue
gh issue create -R <ISSUE_REPO> --title "Design question: ..." --label "design-question,blocked"

# Mark current issue blocked
gh issue edit <ISSUE> -R <ISSUE_REPO> --remove-label in-progress --add-label blocked

# Post explanation
gh issue comment <ISSUE> -R <ISSUE_REPO> --body "Loop stopped: ..."

# Stop the loop — this is how the orchestrator knows to exit
rm {{LOOP_FILE}}
```

---

## Rules

- **Keep the loop running** — `retry` is almost always the right answer
- **Guidance in issue comments** — the iteration agent only reads issues, not PRs
- **Be specific** — "fix the code" is useless; "implement X per design section Y by doing Z" is useful
- **Don't trust claims** — verify against trace and external state
- **`stop` is a last resort** — even a complete rewrite is a `retry`, not a `stop`
- **If you can't audit (trace missing), `stop`** — no one proceeds without review
- **Every `stop` MUST `rm {{LOOP_FILE}}`** — this is the ONLY way to signal the orchestrator to exit. No matter where in the flow you decide to stop, always delete this file
