# Acceptance: submit

Judge the submission report against:

- **Liveness** — the PR / PR comment actually exists: verify with a light `gh pr view <N> -R <REPO> --json url,body` / comment listing yourself. A reported URL that does not resolve is a hard gap (claims-vs-observation, section B of `/Users/mouriya/Ext/app/coder-loop/presets/gh-issue-pr-iteration/quality/honesty.md`).
- **Protocol** — fresh PR: body first line exactly `Closes #<ISSUE>`; retry: a **new** PR-thread comment exists for this run (a body edit alone is a gap). Routing per `common/github-routing.md`.
- **Packet completeness** — the evidence packet carries the layered sections the target workflow demands, with commands/exits/excerpts and embedded screenshots; every claim in the packet traces back to this run's verification report, not to new unverified claims.
- **Delta honesty** — the `Result (run …)` block exists and discloses drift; check it against the intent-action mismatch trigger (quality/honesty.md section B).
- **Hygiene** — no runtime artifacts staged; no merge/close performed.

Gaps go back to the same subagent with precise instructions (e.g. "comment posted to issue instead of PR thread — repost per routing"). After acceptance, the iteration deliverable is review-ready.
