# Acceptance: resolve-blocker

Judge the scoping report against:

- **Concreteness** — the blocking condition names an actual command / path / service / evidence gap, quoted from the live issue, not paraphrased into vagueness. The success condition is observable.
- **Replay present** — the verification plan contains a command that replays the blocked path end-to-end. A plan of unit checks only is a gap: blocked-resolution evidence must be at least as strong as ordinary code evidence **plus** the replay.
- **Minimal scope** — the in-scope surface is the smallest blocker removal; broadening into adjacent work is a gap.
- **No invention** — if facts were missing, the report says which, rather than fabricating a blocker. In that case do not push to implementation: record the missing facts in the handoff and wrap up — review owns the blocked/retry classification.

On acceptance, carry the scoping (blocker, success condition, out-of-scope list, replay command) into the `Step focus` of the implement and verify dispatches — those steps must stay inside this scope.
