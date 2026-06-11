# Report template: verify

Structure your final message exactly as:

```markdown
## Why this verification set
<which checks you chose and why they cover the issue contract; what you deliberately
did not run and why>

## What I actually ran
<per acceptance row: row # / command / exit / actual vs Expect / match or mismatch.
Then: CI detection + parity command + arch + exit + log path; workflow commands with
exit + concise excerpts; artifact list with paths and what each proves>

## Problems
<rows that could not run in this environment (with the alternative proof produced);
failures and hangs observed; infrastructure blockers (exact command + failure mode);
processes started and their PIDs / log paths; files written outside EVIDENCE_DIR>
```
