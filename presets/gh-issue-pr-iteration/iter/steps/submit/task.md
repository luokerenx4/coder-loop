# Step task: submit

You are a submission subagent for one coder-loop iteration. Your dispatch message carries the runtime inputs and a `Step focus`. Your deliverable is the committed, pushed branch plus the PR (fresh run) or PR-thread comment (retry), carrying the evidence packet produced by verification.

## Intent-vs-action delta first

Read the `Intent (run <RUN_ID>)` block in the chain handoff file (`SHARED_CONTEXT_FILE`). Compare it against what this run actually did (per your dispatch `Step focus` and the evidence under `EVIDENCE_DIR`). Append the delta to the handoff under `Result (run <RUN_ID>)`: did action match intent; what drifted and why; what was noticed that intent did not anticipate. Never edit the intent block itself — it is immutable history. A plain "intent matched action" line is fine when true; do not pad it.

## Commit

```bash
git status --short
git add <specific feature/test files and committed screenshots only>
git commit -m "fix(issue-<ISSUE>): <concise description>

Refs: <REPO>#<ISSUE>"
git push -u origin <branch>
```

Never stage loop-data runtime artifacts, scheduling state, run logs, secrets, unrelated dirty files, or local-only evidence.

## PR (fresh) or PR comment (retry)

Routing rules in `/Users/mouriya/Ext/app/coder-loop/presets/gh-issue-pr-iteration/common/github-routing.md` bind this step.

**If an open PR already exists for this issue/branch**: continue it. Push updates, then post a new PR-thread comment containing: which review feedback was addressed; what changed this iteration; the full current layered evidence packet (workflow-defined sections, commands + exit + excerpts/paths, screenshots embedded as Markdown images mapped to what each proves); whether evidence was added, replaced, or deliberately unchanged and why. Never rewrite the PR body — it is the immutable opening cover letter. If the existing body has a structural defect (missing closing keyword, wrong issue), report the defect in your report instead of editing it.

**Otherwise create exactly one PR** following the target workflow file (`WORKFLOW_FILE`):

- body first line exactly `Closes #<ISSUE>`;
- workflow-defined title/body/section/language rules;
- the four-layer evidence packet from this run's verification, with CI detection and parity status;
- screenshots embedded as Markdown images whose paths resolve to committed PR-branch artifacts;
- every artifact mapped to the behavior it proves.

The PR body is a diff cover letter with evidence — do not reconstruct the issue's why or move task scope into it.

## Boundaries

Do not merge anything, close issues, edit issue bodies, or write queue state. Evidence in the packet must satisfy section A of `/Users/mouriya/Ext/app/coder-loop/presets/gh-issue-pr-iteration/quality/evidence.md` — you assemble verified evidence; you do not manufacture new claims beyond what verification produced.

## Report

Report strictly per the report template path given in your dispatch message.
