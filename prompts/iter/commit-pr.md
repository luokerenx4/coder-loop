# Fragment: iter/commit-pr

## Goal

Commit verified changes and create or update the implementation PR.

## Commit

If code changed and verification/evidence is credible:

```bash
git status --short
git add <specific feature/test files and committed screenshots only>
git commit -m "fix(issue-<ISSUE>): <concise description>

Refs: <REPO>#<ISSUE>"
git push -u origin <branch>
```

Do not stage `.coder-loop/runtime/`, `.dev-loop`, `.dev-trace.txt`, secrets, unrelated files, or local-only evidence.

## PR

If an open PR already exists for this issue/branch, push updates to that PR, update the PR body when evidence changed, and post a PR comment explaining which review feedback was addressed.

Otherwise create exactly one PR. The PR must follow the target workflow rules, including:

- first line exactly `Closes #<ISSUE>`;
- workflow-defined title, body, section, language, and evidence formatting;
- CI detection and local CI-parity evidence with command, architecture, exit status, and log excerpt/path when local CI is reproducible;
- runtime/startup/deployment-order evidence when relevant;
- workflow-required artifact or screenshot links when required;
- clear mapping from every artifact, screenshot, or log excerpt to the behavior it proves.

Do not merge or close anything.

## Output verdict

Choose exactly one:

- `pr_ready` → read `iter/handoff`.
- `no_code_change` → read `iter/handoff` with evidence explaining why no PR was created.
- `commit_or_pr_blocked` → read `iter/handoff` with the exact failure.