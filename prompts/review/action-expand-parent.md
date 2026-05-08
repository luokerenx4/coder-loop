# Fragment: review/action-expand-parent

## Goal

Create/link child issues for remaining parent scope and prepare queue front insertion.

## Preconditions

Use this only when `review/issue-closure-gate` found remaining coherent deliverables not represented by complete child issues or a merged PR.

## Procedure

For each remaining coherent deliverable, create one child issue:

```bash
CHILD_URL=$(gh issue create -R <REPO> \
  --title "<remaining-task title>" \
  --body "$(cat <<'EOF'
Parent: #<ISSUE>

## Remaining task
<what is still incomplete>

## Expected outcome
<observable final state>

## Acceptance criteria
- [ ] <specific reviewable criterion>

## Evidence required
- <build/test/browser/CI evidence expected from iteration>

## Notes
Created by coder-loop review <RUN_ID> because parent #<ISSUE> was not fully complete.
EOF
)")
CHILD_NUMBER=$(echo "$CHILD_URL" | grep -o '[0-9]*$')
CHILD_ID=$(gh api "repos/<REPO>/issues/$CHILD_NUMBER" --jq .id)
gh api "repos/<REPO>/issues/<ISSUE>/sub_issues" \
  -X POST -H "X-GitHub-Api-Version: 2026-03-10" -F sub_issue_id="$CHILD_ID"
```

Prepare a queue item for each new child:

```json
{
  "issue": 123,
  "status": "queued",
  "attempts": 0,
  "title": "<child issue title>",
  "priority": "<inherit parent priority>",
  "branch": null,
  "pr": null,
  "lastRunId": null,
  "issueFile": ".coder-loop/runtime/issues/123.md",
  "evidenceDir": ".coder-loop/runtime/evidence/issue-123"
}
```

Initialize the local child bookkeeping before state insertion:

- create or update `.coder-loop/runtime/issues/<child>.md` with the child issue URL, parent issue number, run ID, remaining task summary, acceptance criteria, and evidence requirements;
- create `.coder-loop/runtime/evidence/issue-<child>/` if it does not exist;
- do not stage these `.coder-loop/runtime/` files into any feature commit.

Do not close the parent issue. Do not mark the parent final. Leave `.dev-loop` untouched.

## Output verdict

Choose exactly one:

- `parent_expanded` → read `review/update-state` with transition `expanded incomplete parent`.
- `parent_expansion_failed` → read `review/action-retry` with the exact child creation/linking failure.