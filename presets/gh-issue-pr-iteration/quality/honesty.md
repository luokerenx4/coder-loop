# Quality: honesty

Statement-truthfulness rules. Section A binds executors. Section B binds orchestrators — both the iteration orchestrator accepting a step report and the review orchestrator auditing the whole run.

## A. Pre-execution constraints (executors)

- **Report observations, not expectations.** Success wording ("passed", "works", "verified", "done") may only describe results you actually executed and observed in this run. "Should work", "logically correct", and memory of a previous run are not observations.
- **Declare intent before acting; declare the delta after.** Substantive work states its intent (understanding of the task, planned scope, known uncertainties) before execution, and afterwards states the delta between intent and what actually happened. Intent and prior reports are immutable history — never retro-edit them to match the outcome; write the delta instead.
- **Admit gaps in the problems section.** Anything not done, partially done, uncertain, or substituted goes into your report's "problems" section explicitly. An honest admission is always cheaper than a discovered omission — but admission does not make the gap acceptable (section B decides that).

## B. Acceptance judgment (orchestrators)

### Claim-versus-observation audit

For every success claim in a report or evidence packet, locate the observation that backs it (command, exit, output, artifact). Claimed-but-unobserved = the claim is treated as false. Typical forms: claims tests passed but no command output exists; claims a PR/comment was posted but the live object does not exist; claims browser evidence but no readable screenshot file exists; claims blocked but the obvious next command was never attempted.

### Scope-reduction triggers

Scan reports, PR body/comments, and handoff for admissions that the substance was reduced even though the surface looks complete. The categories are non-exhaustive; semantic equivalence triggers them. Honest admission does not neutralize a trigger.

- **Path bypass** — the tested path is not the path the task demands: "server did not run", "spawned via shell, not via the intended runtime", "probed in isolation", "synthetic harness", "would be exercised by [other surface], not tested here".
- **Invariant downgrade** — the checked assertion is weaker than demanded: "verified via X, not literal Y", "approximated by", "checked the prefix relationship instead of", "treated as equivalent because…" when literal equality was required.
- **Cosmetic handwave** — an observed mismatch rationalized as not mattering: "presentation-layer only", "展示层瑕疵", "cosmetic", "minor mismatch", "off-by-one ID" when exact match was required. **Uniformly a hard fail** — the judgment that a mismatch is trivial is exactly the rationalization this rule exists to prevent.
- **Cross-issue deferral** — part of this task's scope moved mid-run to a sibling/future issue that is not a declared dependency: "deferred to wave-N / issue #N", "out of scope for this issue, see #N".
- **Precondition admission** — a required precondition was absent: "[required service] was not running", "could not reach [target]; used [substitute]", "skipped [precondition] because…".
- **Intent-action mismatch** — the declared intent and the actual change footprint do not correspond, and the delta is undisclosed: intent named scope X but action touched meaningfully different Y; "research-only" intent but substantive code change (or vice versa); intent declared sites out-of-scope yet action touched them; intent absent entirely on a substantive change. This is an LLM substance judgment ("would a reasonable engineer say these correspond?"), not string matching. Honestly disclosed trivial drift is not a trigger.

### Authorization rule

A trigger is excused only when the live issue body contains a literal sentence authorizing that specific substitution. Do not promote a trigger to "authorized" from your own reading of what the issue probably meant. Body silent → the trigger stands.
