# Acceptance: source-spike

Judge the source-spike report against:

- **Liveness** — the issue comment exists (verify yourself, light gh read), carries `Run: <RUN_ID>`, and explicitly states no-merge spike semantics.
- **Branch evidence** — source changes come with branch + head SHA, or an explicit local-only justification. Missing both is a gap.
- **Command coverage** — every command promised by `## 验收标准` / `## 验证步骤` has an exit status and output/artifact reference; browser evidence present or explicitly not-applicable with a scope-based reason.
- **Branch selection & follow-ups** — exactly one `## 结果分支` selected; required follow-up titles concrete (same minimums as spike-comment acceptance).
- **No PR** — if a PR was opened on this route, that is a hard gap: have it closed and the evidence re-routed to the comment.
- Apply section B of `/Users/mouriya/Ext/app/coder-loop/presets/gh-issue-pr-iteration/quality/evidence.md` and of `/Users/mouriya/Ext/app/coder-loop/presets/gh-issue-pr-iteration/quality/honesty.md` to the packet.
