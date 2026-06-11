# Report template: replay (review)

Structure your final message exactly as:

```markdown
## Replay strategy
<branch/state replayed against; which rows ran locally vs were artifact-verified vs
re-executed in their environment; what could not be attempted and why>

## Row results
| Row | Check | Command/artifact | Actual (exit/output/ref) | Expect | Verdict |
|---|---|---|---|---|---|
<one line per acceptance + inherited row — every row, including could-not-execute>

## Packet spot-replay
<per replayed claim: packet's claim vs your observation, with command + exit + excerpt>

## Checks and mergeability
<check names / statuses / conclusions / timestamps / head SHA / elapsed; hung-or-running
assessment; mergeStateStatus>

## Problems
<rows that could not execute (exact error); environment limits; processes started
(PIDs / log paths) and files written, for the cleanup ledger>
```
