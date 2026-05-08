# /dev-plan — Prepare a large task for coder-loop

Use this command when the user has a large task, design, roadmap, or vague goal that is too large for a single PR. The output is a GitHub issue queue and target repo coder-loop runtime state. Do not start implementation directly.

This command is the required intake path before coder-loop execution for large work:

```text
large task / design
  → atomic GitHub issues with executable checkpoints
  → issue parent/child graph
  → .coder-loop/runtime queue
  → /dev-loop
```

## Canonical user-level rules

Apply these user-level skills/rules while planning:

- `~/.claude/rules/github-issue-pr-routing.rule.md` — issue/PR routing source of truth.
- `writing-issue` — issue body form, parent-child placement, executable checkpoints, spikes, inherited obligations.
- `writing-pr` — PR body/evidence rules that generated issues must make possible later.
- `review-pr` — review gates that generated issues and checkpoints must be strong enough to pass later.

Coder-loop does not replace these rules. It consumes the GitHub issue queue they produce.

## Inputs

Accept any of:

- a design document path;
- a GitHub issue/PR/RFC link;
- a user-described large task;
- a repository path plus goal;
- a cross-repo initiative.

If the source is insufficient to create executable issues, ask for the missing design facts. Do not invent scope.

## Step 1: collect source and target topology

Determine:

- target issue repository;
- implementation repository or repositories;
- local path for each repository;
- base branch for each repository;
- existing repo instructions (`CLAUDE.md`, `.coder-loop/workflow.md`, README, package scripts, Makefile/mise tasks);
- existing GitHub issues/PRs that overlap the requested work.

If the target repository lacks committed `.coder-loop/workflow.md`, create or request it before queueing work. Workflow must define project-specific commands, PR/evidence style, and review expectations. Runtime files belong under `.coder-loop/runtime/` and must stay ignored.

## Step 2: classify the work

Classify each candidate deliverable as one of:

- `implementation` — future code/config work;
- `spike` — verifies a risky assumption before implementation;
- `parent` — umbrella/coordinator issue with child deliverables;
- `design-question` — missing or contradictory source facts block issue creation;
- `no-code` — already satisfied, duplicate, invalid, or out of scope.

Do not create a single issue for unrelated deliverables. One issue, one problem.

## Step 3: decompose into atomic issues

Use `writing-issue` rules:

- issue title/body follow the user's language/style requirements;
- issue body carries problem, why, expected outcome, constraints, checkpoints, dependencies;
- issue body does not prescribe implementation internals unless externally imposed by the source;
- acceptance criteria are executable checkpoint rows with `Dimension`, `Check`, `Command`, `Env`, `Expect`;
- checkpoints verify outcomes, not preferred implementation choices;
- dimensions cover real risk: `function`, `environment`, `integration`, `assumption`;
- high-risk undocumented assumptions become spike issues before implementation;
- deferred verification becomes inherited verification obligations and cannot be deferred twice.

Every issue must be independently actionable by a stateless agent reading only GitHub issue state plus repo instructions.

## Step 4: adversarial validation before creation

Before creating GitHub issues, validate every draft:

- Can the minimum-effort implementation pass the checkpoints while leaving the user-visible problem unsolved? If yes, sharpen checkpoints.
- Are terms ambiguous against repo docs, existing `CLAUDE.md`, or sibling issues? If yes, disambiguate inline.
- Does any issue mix unrelated problems? If yes, split.
- Does any issue require a PR to close multiple independent issues? If yes, split.
- Does each future-work issue have commands that can actually run in a named environment? If not, create a spike or inherited obligation.
- Would `review-pr` be able to decide closure from the issue, PR evidence, and child graph? If not, improve issue/checkpoint structure before creation.

Do not rely on coder-loop iteration or review agents to repair bad planning.

## Step 5: create the GitHub issue graph

Create issues with `gh issue create`. Link parent/child relationships with issue-to-issue sub-issue links only; PRs are never sub-issue children.

For sub-issue links, use GraphQL `addSubIssue` with Issue node IDs. A child issue has only one parent; competing ownership gets a prose reference, not a second sub-issue edge.

Do not use PRs as task containers. Do not create a PR during planning.

## Step 6: initialize coder-loop runtime queue

After issues exist, create or update target runtime files under `.coder-loop/runtime/`:

```text
.coder-loop/runtime/config.json
.coder-loop/runtime/state.json
.coder-loop/runtime/shared.md
.coder-loop/runtime/issues/<issue>.md
.coder-loop/runtime/evidence/issue-<issue>/
.coder-loop/runtime/logs/
```

Runtime files are local scheduling/handoff state, not durable task semantics. Do not commit them.

Queue only actionable issues:

- include implementation issues and spike issues that are ready to run;
- order prerequisites before dependents;
- do not queue parent-only umbrella issues until they have a concrete closure/review task;
- do not queue blocked/design-question/no-code issues as implementation work;
- if existing open issues already represent part of the work, reuse them instead of duplicating.

Each queue item should include issue number, title, status, priority, branch/pr fields when known, issue handoff path, and evidence directory path matching coder-loop runtime expectations.

## Step 7: validate runtime schema

After writing `.coder-loop/runtime/config.json`, `.coder-loop/runtime/state.json`, issue handoff files, and evidence directories, run the executable runtime check:

```bash
bun /path/to/coder-loop/src/loop.ts --target-cwd <target-repo-path> --check-runtime
```

If `coder-loop` is on PATH, this equivalent form is also valid:

```bash
coder-loop --target-cwd <target-repo-path> --check-runtime
```

The check must pass before handing off to `/dev-loop`. If it fails, fix the runtime files and run it again. Do not ask the user to start `/dev-loop` against an unchecked or failing runtime queue.

## Step 8: final report and handoff

Report:

- created/reused issue numbers and parent/child structure;
- queue order and why;
- spikes and inherited obligations;
- any design questions or blockers not queued;
- runtime schema check command and result;
- exact command to start execution: `/dev-loop` or `/dev-loop <N>`.

Do not start `/dev-loop` unless the user explicitly asked to both plan and run.

## Non-goals

- Do not implement code.
- Do not open PRs.
- Do not merge or close issues.
- Do not invent requirements, conventions, or verification environments.
- Do not put project-specific commands into coder-loop core prompts; put them in target `.coder-loop/workflow.md`.
- Do not hand off to `/dev-loop` until `--check-runtime` passes.
