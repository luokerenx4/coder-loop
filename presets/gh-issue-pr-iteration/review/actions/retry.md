# Action: retry

Publish precise feedback for work that remains actionable.

## Feedback target

- Live implementation PR exists → all retry feedback on that PR. Prefer `gh pr review --request-changes`; if GitHub rejects a formal self-review, post an ordinary PR comment.
- No PR → feedback as an issue comment.
- Never post PR-related review results only to the issue.

## Feedback body

Include: what was done (from trace/reports); the specific failures — every failed judgment with its exact trigger quote, and every failed replay row (#, Check, Command, actual vs Expect) in one list so iteration fixes them all in one retry; required changes; evidence status (whether review stopped before replay); live CI observation and hung/timeout assessment when relevant; constraints (do not bypass coder-loop review, do not merge manually, do not close the issue manually).

If a row failed because the issue body's Command itself is broken, the feedback instructs fixing the issue contract first, then re-running — not reinterpreting the row.

## After publishing

Feedback durably posted → write state per `/Users/mouriya/Ext/app/coder-loop/presets/gh-issue-pr-iteration/review/actions/state-write.md` with transition `retry`, then continue the entry's wrap-up.

Feedback publication itself failed → do not update local state as if feedback were durable; take the stop action with the exact failure.
