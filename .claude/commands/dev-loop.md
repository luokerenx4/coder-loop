# /dev-loop — Start coder-loop

Launch coder-loop after `/dev-plan` has created or refreshed the GitHub issue queue and `.coder-loop/runtime/state.json`. This command does not decompose large work; it only runs the existing queue.

Launch the orchestrator as a detached background process that survives this shell session.

```bash
LOGFILE="/tmp/coder-loop-$$.$(date +%Y%m%d-%H%M%S).log"
nohup coder-loop $ARGUMENTS > "$LOGFILE" 2>&1 &
echo "coder-loop started (pid=$!, log=$LOGFILE)"
```

If `coder-loop` is not in PATH, use the full path:

```bash
LOGFILE="/tmp/coder-loop-$$.$(date +%Y%m%d-%H%M%S).log"
nohup bun /path/to/coder-loop/src/loop.ts $ARGUMENTS > "$LOGFILE" 2>&1 &
echo "coder-loop started (pid=$!, log=$LOGFILE)"
```

- No argument: run indefinitely until review agent stops the loop.
- Pass a number to limit iterations, e.g. `/dev-loop 10`.
- Recovery/resume is derived from `.coder-loop/runtime/state.json` `current.phase`: `review` resumes review without rerunning iteration; `iteration` resumes/continues iteration.

Monitor: `tail -f $LOGFILE`

Stop: `rm .dev-loop`
