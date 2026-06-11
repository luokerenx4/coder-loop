# Acceptance: implement

Judge the implementation report against:

- **Contract coverage** — every acceptance row and custom-section requirement of the live issue body is either addressed, or flagged with a concrete deviation reason. Silent drops are gaps. (Cross-check the report's coverage claims against the issue body you read during investigation; re-fetch if stale.)
- **Classification sanity** — the declared change kind matches what the issue demands; for substitutive/removal work the footprint list exists and each site has an owner. "Added the new thing" with the old thing unaccounted for is the classic trap — a gap.
- **Intent landed** — the handoff file contains an `Intent (run …)` block for this run. Missing intent on a substantive change is a gap (review will hard-fail it later).
- **Boundary compliance** — no batching, no test weakening, no commits/PRs/GitHub writes from this step.
- Apply section B of `/Users/mouriya/Ext/app/coder-loop/presets/gh-issue-pr-iteration/quality/honesty.md` — especially intent-action mismatch and cross-issue deferral triggers in the report itself.

Code quality (style, naming, architecture) is not your gate — judge whether the task landed per contract, not whether you would have written it differently. Send back precise gap lists; do not fix code yourself.
