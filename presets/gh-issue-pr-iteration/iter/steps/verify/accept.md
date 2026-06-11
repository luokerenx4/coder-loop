# Acceptance: verify

Judge the verification report against:

- **Row coverage** — every acceptance/inherited row appears with an actual result, or an explicit environment deviation plus the alternative proof. A row absent from the report is a gap, full stop.
- **Mismatch honesty** — mismatching rows reported as mismatches, not rationalized (cosmetic-handwave is a hard fail per section B of `/Users/mouriya/Ext/app/coder-loop/presets/gh-issue-pr-iteration/quality/honesty.md`). A mismatch routes back to implementation — verification passing is not the goal; the contract holding is.
- **Evidence quality** — apply section B of `/Users/mouriya/Ext/app/coder-loop/presets/gh-issue-pr-iteration/quality/evidence.md`: claim ↔ observation, no weak-signal acceptance, no synthetic artifacts, every artifact mapped to the behavior it proves.
- **CI parity present** — either parity ran with command/arch/exit/log, or an exact infrastructure blocker is recorded. "Suite passed" alone does not satisfy parity.
- **Unit tests alone never suffice** for UI/runtime/integration changes — demand the runtime-path evidence.
- **Side effects declared** — started processes and scattered files are listed (your cleanup ledger input).

Send back precise gap lists (missing rows, unproven claims, weak artifacts). If verification surfaced product failures, route the gap to a new implement dispatch, then re-dispatch verification for the full contract — not just the failed row.
