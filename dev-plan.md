# /dev:plan — Design-to-Loop Adapter

You are spawned via `claude -p` to convert an existing design into loop-executable format. You do NOT design. You adapt.

**Input:** design documents + repos
**Output:** GitHub Issues + per-repo CLAUDE.md

---

## Step 0: Find the Design

Look for design documents. Possible locations:

```bash
# In current repo
find . -name '*.md' -not -path '*/node_modules/*' -not -path '*/.git/*' | head -30
cat README.md 2>/dev/null

# User may have provided a path or URL in the prompt
# User may reference another repo's docs
gh api repos/<owner>/<repo>/contents/<path> --jq '.content' | base64 -d
```

A "design" is anything that specifies:
- What components exist and their responsibilities
- How components interact (data flow, APIs, protocols)
- Technology choices
- Directory structure

**If design exists → Step 1.**
**If NO design exists → return `need_design` with questions.**

### need_design questions

When no design doc is found, ask the user:

- What does this project do? (one paragraph)
- What are the main components and their responsibilities?
- What technology stack for each component?
- How do components communicate? (API, events, shared DB, etc.)
- What repos are involved and what role does each play?

After the user answers, re-run plan with the answers as context. Plan STILL doesn't design — it takes the user's answers as the design source.

---

## Step 1: Collect Project Topology

### 1.1 Discover All Repos

```bash
# Current repo
git remote get-url origin 2>/dev/null

# Ask: what other repos are involved?
# Check design doc for repo references
# Check user's org for related repos
gh repo list <org> --limit 50 --json name,description 2>/dev/null
```

For each repo, collect:

```bash
# Identity
git remote get-url origin
git rev-parse --show-toplevel

# Tech stack (parallel reads)
cat package.json 2>/dev/null           # Node/Bun
cat tsconfig.json 2>/dev/null          # TypeScript
cat go.mod 2>/dev/null                 # Go
cat Cargo.toml 2>/dev/null             # Rust
cat pyproject.toml 2>/dev/null         # Python
ls *.tf 2>/dev/null                    # Terraform/OpenTofu
cat Makefile 2>/dev/null               # Make
cat docker-compose*.yml 2>/dev/null    # Docker

# Existing conventions
cat .editorconfig .prettierrc .eslintrc* 2>/dev/null
git log --oneline -10 2>/dev/null      # Commit style

# Verify commands
jq -r '.scripts | to_entries[] | "\(.key): \(.value)"' package.json 2>/dev/null
grep -E '^[a-zA-Z_-]+:' Makefile 2>/dev/null

# Default branch
gh repo view --json defaultBranchRef --jq .defaultBranchRef.name 2>/dev/null

# Existing issues
gh issue list --state open --limit 20 --json number,title,labels 2>/dev/null
```

### 1.2 Map Cross-Repo Relationships

From design doc, extract:
- Which repo holds which component
- Dependency direction between repos (e.g., IaC must run before app deploys)
- Where shared types/configs live
- Which repo hosts the issue tracker

### 1.3 Learn Existing Conventions

If a repo already has code, learn its conventions — don't invent new ones:

```bash
# Existing code patterns
ls src/ lib/ packages/ cmd/ 2>/dev/null
# Existing test patterns
ls __tests__/ test/ tests/ *test* *spec* 2>/dev/null
# Import style, error handling, naming — read 2-3 existing files
```

If a repo already has a CLAUDE.md, read it and preserve what's there.

---

## Step 2: Decompose Design into Issues

Read the design document. Extract tasks.

### 2.1 Decomposition Rules

- **Follow the design's structure** — if it has phases/sections/components, those become issues
- **Dependency order** — issues must be executable in sequence
- **One repo per issue** — if a phase spans repos, split into one issue per repo
- **Acceptance criteria from design** — every issue gets testable criteria derived from the design, expressed as executable checkpoints (see §2.2)
- **Don't add your own ideas** — if the design doesn't mention it, don't create an issue for it
- **Risk-first decomposition** — scan for third-party assumptions and cross-environment dependencies BEFORE structural decomposition. Create spikes (§2.5) for high-risk assumptions
- **Completeness monotonicity** — when ordering issues, ensure that cumulative completeness (total passed checkpoints / total checkpoints across all issues so far) never decreases. Do not structure a plan where multiple implementation Phases precede the first environment or integration checkpoint

### 2.2 Issue Format

Each issue must contain enough context for the iteration agent to work independently:

```markdown
## Goal
<from design document — what this task accomplishes>

## Context
- **Repo**: `owner/repo` (path: `/local/path`)
- **Working directory**: `<within repo>` (if applicable)
- **Design doc**: `<path>` section <N>

## Technical Approach
<from design document — NOT your interpretation>

## Acceptance Criteria

Each criterion is a checkpoint with dimension, command, environment, and expected result.
Dimensions: `function` (code logic), `environment` (runs in target env), `integration` (output consumable by downstream), `assumption` (third-party behavior holds).

| # | Dimension | Check | Command | Env | Expect |
|---|-----------|-------|---------|-----|--------|
| 1 | function | <what it verifies> | `<executable command>` | local / VM / CI | <expected output or exit code> |
| 2 | environment | <what it verifies> | `<executable command>` | VM | <expected> |
| 3 | integration | <what it verifies> | `<executable command>` | VM | <expected> |
| 4 | assumption | <what it verifies> | `<executable command>` | VM | <expected> |

Rules:
- Every issue MUST have at least one checkpoint per relevant dimension. If an issue involves Docker, it MUST have an `environment` checkpoint. If it produces output consumed by another Phase, it MUST have an `integration` checkpoint. If it relies on third-party component behavior, it MUST have an `assumption` checkpoint.
- Each checkpoint is independently verifiable — a failure at checkpoint N tells the iteration agent exactly what broke and where, so it can fix that specific step rather than retry blindly.
- Checkpoints within a dimension should be ordered from simplest to most complex (e.g., "Dockerfile syntax" before "docker build" before "container starts" before "service responds").
- Do NOT write checkpoints that cannot be executed in any available environment. If no environment can run a check, flag it and create a spike (see §2.5).

## Inherited Verification Obligations

If this issue inherits deferred checks from an earlier Phase, list them here:

| From | Original # | Check | Command | Env | Expect |
|------|-----------|-------|---------|-----|--------|
| Phase N | ac-K | <what> | `<cmd>` | <env> | <expect> |

Rules:
- Inherited obligations count toward this issue's completeness (passed checkpoints / total checkpoints).
- An obligation CANNOT be deferred more than once. If it was already deferred to reach this issue, plan must NOT create another issue to defer it further.

## Dependencies
- Depends on: #<N> (<what it needs from that issue>)
  - Required postconditions: <list specific checkpoint IDs from #N that must be passed>
- Blocks: #<N> (<what depends on this>)
```

### 2.3 Cross-Repo Issues

When an issue works in a different repo than the issue tracker:

```markdown
## Context
- **Repo**: `other-owner/other-repo` (path: `/local/path`)
- **Conventions**: follow `other-repo`'s existing patterns, NOT this repo's
```

### 2.4 Splitting Check

For each candidate issue:

**Structural signals:**

| Signal | Action |
|---|---|
| Design has sub-sections for this component | Split into sub-issues |
| Task spans 2+ repos | Split: one per repo |
| Task has clear layers (types → impl → API → test) | Split by layer |
| Task is small and self-contained | Don't split |

**Risk signals:**

| Signal | Action |
|---|---|
| Task depends on undocumented behavior of a third-party component (e.g., a specific browser's CDP implementation, an OS package's runtime behavior) | Extract a **spike** (§2.5) as a prerequisite issue |
| Task assumes cross-network or cross-environment connectivity (e.g., host → container, container → container) | Extract an **integration spike** to verify in target environment |
| Design doc uses speculative language ("should work", "expected to", "presumably") for a technical claim | Extract a **spike** to produce concrete evidence |

Risk signals take priority over structural signals. A spike must be created and resolved BEFORE the implementation issue it de-risks.

### 2.5 Spike Issues

A spike is a timeboxed verification task that validates a technical assumption before committing to implementation. Spikes are NOT implementation — they produce evidence, not production code.

**Spike issue format:**

```markdown
## Goal
Verify assumption: <the specific technical claim to validate>

## Context
- **Repo**: `owner/repo` (path: `/local/path`)
- **Design doc**: `<path>` section <N>
- **Assumption source**: <quote from design doc or inferred from architecture>

## Verification Steps
1. <concrete step to test the assumption>
2. <concrete step>
3. ...

## Acceptance Criteria

| # | Dimension | Check | Command | Env | Expect |
|---|-----------|-------|---------|-----|--------|
| 1 | assumption | <what it verifies> | `<cmd>` | VM | <expect> |

## Outcomes
- **If passed**: Assumption holds. Proceed to implementation issue #<N>.
- **If failed**: Create a `design-question` issue with the evidence. Do NOT proceed to implementation.

## Dependencies
- Blocks: #<N> (implementation issue that relies on this assumption)
```

**When to create spikes:**
- The assumption involves a third-party binary/package whose behavior is not guaranteed by its documentation
- The assumption has never been tested in the target environment
- Failure of the assumption would invalidate the architecture (not just require a workaround)

**When NOT to create spikes:**
- The behavior is well-documented and widely known (e.g., "nginx serves static files")
- The assumption can be trivially verified as part of implementation (e.g., "bun can import this package")

---

## Step 3: Create Issues on GitHub

```bash
OWNER="<from git remote>"
REPO="<from git remote>"
ISSUE_REPO="$OWNER/$REPO"  # or user-specified

# Labels
for i in $(seq 1 $TOTAL_PHASES); do
  gh label create "phase-$i" --repo "$ISSUE_REPO" --color "0E8A16" --force 2>/dev/null
done
gh label create "in-progress" --repo "$ISSUE_REPO" --color "FBCA04" --force 2>/dev/null
gh label create "blocked" --repo "$ISSUE_REPO" --color "D93F0B" --force 2>/dev/null
gh label create "design-question" --repo "$ISSUE_REPO" --color "D876E3" --force 2>/dev/null

# Create issues
ISSUE_URL=$(gh issue create -R "$ISSUE_REPO" \
  --title "Phase N: <title>" \
  --body "..." \
  --label "phase-N")

# Sub-issues (if split)
CHILD_URL=$(gh issue create -R "$ISSUE_REPO" --title "Phase N.M: <sub>" --body "..." --label "phase-N")
CHILD_NUMBER=$(echo "$CHILD_URL" | grep -o '[0-9]*$')
CHILD_ID=$(gh api "repos/$ISSUE_REPO/issues/$CHILD_NUMBER" --jq .id)
gh api "repos/$ISSUE_REPO/issues/$PARENT/sub_issues" \
  -X POST -H "X-GitHub-Api-Version: 2026-03-10" -F sub_issue_id="$CHILD_ID"
```

---

## Step 4: Generate CLAUDE.md (per repo)

Each modifiable repo gets a CLAUDE.md. Content is DETECTED or EXTRACTED, not invented.

```markdown
# CLAUDE.md — {repo_name}

## Project Context
- **Project**: {name} — {from design doc}
- **This repo's role**: {app / iac / shared-lib / ...}
- **Design doc**: {path or cross-repo reference}

## Related Repos
| Repo | Role | Relationship |
|---|---|---|
| owner/other | iac | This repo's app depends on its VM |

## Issues
- Tracked in: `{issue_repo}`

## Tech Stack
{detected from Step 1}

## Directory Structure
{detected from existing code OR prescribed by design doc}

## Code Conventions
{detected from existing code OR prescribed by design doc}
{if repo already has code, infer from it — don't impose new style}

## Verification Commands
- Test: `{detected}`
- Lint: `{detected}`
- Typecheck: `{detected}`
- Build: `{detected}`

## Commit Format
{detected from git log, or project-wide standard}
```

**If repo already has CLAUDE.md**: merge, don't overwrite. Add project context, keep existing conventions.

---

## Step 5: Validate

```bash
# Issues created
ISSUE_COUNT=$(gh issue list -R "$ISSUE_REPO" --state open --json number --jq 'length')
[ "$ISSUE_COUNT" -gt 0 ] || echo "FAIL"

# CLAUDE.md in each modifiable repo
for REPO_PATH in ...; do
  test -f "$REPO_PATH/CLAUDE.md" || echo "FAIL: $REPO_PATH"
done

# At least one verify command works per repo (where code exists)
```

验证通过后报告创建了多少 issues 和 repos。

---

## Rules

- **You do NOT design** — you adapt what's already designed
- **You do NOT invent conventions** — you detect from existing code or extract from design
- **You do NOT add issues the design doesn't call for** — no scope creep
- **Cross-repo conventions are per-repo** — IaC repo follows IaC patterns, not app patterns
- **Existing CLAUDE.md is preserved** — merge, don't overwrite
- **If no design exists, ask** — return `need_design`, don't guess
- **Every checkpoint must be executable** — if you write a checkpoint, it must have a command that an agent can run. "docker build succeeds" without a command is not a checkpoint
- **Spikes before implementation** — if a task depends on an unverified third-party assumption, the spike MUST be created and ordered before the implementation issue
- **Dimensional coverage is mandatory** — do not create issues that only have `function` checkpoints when the task involves Docker, networking, or third-party components
- **Deferred verification becomes an inherited obligation** — if a checkpoint cannot be verified in the current issue's environment, plan must place it in the Inherited Verification Obligations section of a downstream issue. Do not leave it unassigned
