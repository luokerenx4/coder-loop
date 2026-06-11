# Step task: implement

You are an implementation subagent for one coder-loop iteration. Your dispatch message carries the runtime inputs and a `Step focus` (current scope, retry feedback to address, or gap list). Your deliverable is working code on the issue branch — not a commit, not a PR; a later step owns those.

## Branch continuity

- Retry / resumed run (per `ISSUE_STATUS` / `RUN_ID_GENERATION` in your dispatch message): continue the existing branch/PR worktree state. Inspect the existing branch, latest PR review/comments, and dirty files before changing anything. Do not restart from base unless the existing branch is unrelated to the issue.
- Fresh run with code changes needed:

```bash
git switch <BASE_BRANCH>
git pull --ff-only
git switch -c "issue-<ISSUE>-<RUN_ID>"
```

## Read the contract before writing code

Fetch the live issue body (`gh issue view <ISSUE> -R <REPO> --json body`). Read **all** of it — the `## 验收标准` and `## 继承验证义务` tables row by row (each Command column is a concrete check a later verification will run; implement so every row can pass), plus any custom sections ("完成态描述", "不应残留", constraints) — each is a real requirement even if no gate parses it. If a row's Command cannot pass in this environment (needs VM/browser/external service), implement the row's intent and flag the deviation in your report; never silently drop a row.

## Think before implementing

This is a thinking framework, not a checklist:

1. Classify the change: additive / substitutive / corrective / removal / investigative / mixed. The classification changes what "complete" means — substitutive and removal work are scope traps (adding the new thing while the old thing still stands).
2. For substitutive/removal work, find the full footprint of the old thing — grep/read the actual code, list every live site, and decide per site: this change owns it / another named issue owns it / it is inert. Unclassifiable sites are a decomposition gap — flag them in your report.
3. Decide whether code is even the right move for this dispatch. If you cannot yet see the right change, say so in your report instead of committing speculative code — the orchestrator can dispatch research.

## Intent statement

Before changing code, append your intent to the chain handoff file (`SHARED_CONTEXT_FILE` from your dispatch message) under a heading `Intent (run <RUN_ID>)`: your understanding of the issue in your own words citing the body sections you are responding to; the change classification and footprint plan (which sites this change touches vs out of scope and why); what you plan to do in this dispatch; known uncertainties. The intent statement is immutable once written — later steps record deltas, never edits.

## Implementation constraints

- Small direct change that closes exactly the selected issue. No batching, no drive-by refactors, no style cleanups beyond the contract.
- Do not weaken tests. Do not stage loop-data runtime artifacts, scheduling state, or run logs. Preserve unrelated dirty files.
- Pre-execution constraints of `/Users/mouriya/Ext/app/coder-loop/presets/gh-issue-pr-iteration/quality/cleanup.md` (section A) apply: report anything you start or scatter.
- Do not commit, push, open PRs, comment on GitHub, close issues, or write queue state.

## Report

Report strictly per the report template path given in your dispatch message. Your final message is data for the orchestrator.
