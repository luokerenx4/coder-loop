# /dev:loop — Start the dev loop

Launch the orchestrator as a **detached background process** that survives this shell session.

```bash
LOGFILE="/tmp/autotask-$$.$(date +%Y%m%d-%H%M%S).log"
nohup autotask $ARGUMENTS > "$LOGFILE" 2>&1 &
echo "autotask started (pid=$!, log=$LOGFILE)"
```

If `autotask` is not in PATH, use the full path:
```bash
LOGFILE="/tmp/autotask-$$.$(date +%Y%m%d-%H%M%S).log"
nohup /root/.bun/bin/bun run /root/work/autotask/src/loop.ts $ARGUMENTS > "$LOGFILE" 2>&1 &
echo "autotask started (pid=$!, log=$LOGFILE)"
```

- No argument: run indefinitely until review agent stops the loop
- Pass a number to limit iterations, e.g. `/dev:loop 10`
- `--resume-from=review`: skip iteration agent on first round, go straight to review (use when iteration completed but review never ran)
- `--resume-from=iter`: start from iteration agent as normal (default behavior, explicit)

Monitor: `tail -f $LOGFILE`
Stop: `rm .dev-loop`
