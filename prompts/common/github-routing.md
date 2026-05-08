# Fragment: common/github-routing

## Purpose

This fragment defines where durable task context, implementation evidence, and review conversation belong.

## Issues

GitHub issues carry task semantics:

- problem statement and why;
- acceptance criteria and scope boundaries;
- parent/child placement;
- blockers, invalidity, duplicate/no-code status, and follow-up work.

Issues can be parent/child nodes. PRs cannot be sub-issue children.

## Pull requests

Pull requests carry implementation semantics:

- one PR closes one issue;
- the first PR body line must be the closing keyword for the selected issue when required by the workflow;
- the PR body and PR thread contain implementation evidence, CI/check status, and implementation review discussion.

Do not open a PR without a real issue for it to close. Do not use a PR as a task container.

## Conversation routing

- Before an implementation PR exists, discuss task scope, blockers, invalidity, duplicate/no-code status, and retry feedback on the issue.
- Once an implementation PR exists, implementation and review discussion belongs on the PR thread.
- For an open PR, reply to review feedback on the PR thread, not on the issue.
- Post on the issue after a PR exists only when the issue topic itself is disputed, the work is blocked/skipped/no-code, or the current PR is explicitly invalid and a replacement path is needed.
- Local handoff files are bookkeeping, not a substitute for GitHub PR review.

## Merge and closure ownership

The review agent owns PR merge, issue closure, final local state transitions, child issue creation, and sub-issue linking. The iteration agent must never perform those actions.