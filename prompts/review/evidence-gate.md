# Fragment: review/evidence-gate

## Goal

Audit whether the PR body and PR thread contain enough reviewer-consumable evidence before code review.

## CI-parity evidence

Reject unless the evidence states:

- whether project CI was detected;
- local CI-parity command when reproducible CI exists;
- workflow/job or equivalent CI target;
- runner architecture choice and caveats;
- exit status;
- log path or concise log excerpt.

Remote PR checks are Phase C mergeability signals. They do not replace iteration-stage local CI-parity evidence when local CI can be reproduced.

If local CI-parity could not run because of Docker, act installation, image pull, network, runner tooling, or third-party limitations, choose retry or blocked depending on whether an immediate retry can help. Do not accept as if CI passed.

## Target workflow evidence

Reject unless reviewer-consumable evidence satisfies the target workflow file:

- required build, test, lint, typecheck, migration, browser, deployment-preview, or runtime checks are present with command names, exit status, and concise log excerpts or paths;
- workflow-defined command wrappers/prohibitions were followed;
- workflow-required artifacts, screenshots, logs, or PR-body sections are present and reviewer-visible;
- evidence maps each artifact or log excerpt to the behavior it proves;
- positive and negative/error/disabled paths are covered when required by workflow or issue scope.

Review does not create missing workflow evidence. If evidence is absent, stale, local-only, ambiguous, or impossible to inspect, reject before code review.

## Output verdict

Choose exactly one:

- `evidence_passed` → read `review/code-gate`.
- `retry` → read `review/action-retry`.
- `blocked` → read `review/action-blocked`.

If evidence is insufficient, stop before code review and make the feedback precise.