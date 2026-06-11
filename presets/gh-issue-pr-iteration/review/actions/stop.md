# Action: stop

Stop the loop for mechanical completion or review infrastructure failure. Use only when: no actionable queue item exists and global assessment confirms completion; review infrastructure is broken and state cannot be safely audited/updated; the trace or required runtime files are unavailable and continuing would tight-loop or corrupt state; or a required GitHub side effect failed before durable feedback/closure/linking/unblock was published, so local state must not advance as if it succeeded.

Never use stop for bad code, weak evidence, failed tests, PR conflicts, pending checks, merge failure, or unproven blocked/skip claims — those are retry or blocked.

## Procedure

- State readable → record the actionable/non-actionable classification before stopping.
- State unreadable → record the exact infrastructure failure.
- For an accepted-but-unpublished side-effect failure: append a handoff note with the accepted verdict, failed command, target repo/PR/issue, command output, and why rerunning would hit the same boundary.
- Remove central daemon scheduling state only for mechanical completion or infrastructure failure.
- Do not mark the selected issue `done` / `moot` / `blocked` unless the corresponding action already proved and performed that transition.

Then continue the entry's wrap-up with `verdict=stop`.
