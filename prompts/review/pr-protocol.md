# Fragment: review/pr-protocol

## Goal

Audit PR identity, body structure, and conversation routing before evidence/code review.

## Checks

For the selected issue:

- one implementation PR must close exactly one issue;
- PR body first line must be exactly `Closes #<ISSUE>` when a PR exists;
- PR title/body, sections, language, and evidence formatting must satisfy workflow-defined requirements;
- PR body or PR-thread evidence must state CI detection and local CI-parity status when the project has reproducible CI;
- once an implementation PR exists, implementation/review discussion must be on the PR thread;
- if the latest retry response only appears on the issue after a PR exists, reject and require a PR-thread reply.

## No-PR cases

If no PR exists, continue only when the trace/handoff/live issue evidence indicates an allowed no-PR path: already satisfied on base, invalid, duplicate, no-code, moot, parent/wrapper classification, incomplete parent expansion, blocked, or implementation/PR creation failure requiring retry.

## Output verdict

Choose exactly one:

- `pr_protocol_passed` → read `review/evidence-gate`.
- `no_pr_semantic_review` → read `review/issue-closure-gate`.
- `retry` → read `review/action-retry`.

Do not inspect code until PR protocol passes.