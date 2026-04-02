# /dev:loop — Start the dev loop

Launch the orchestrator as a **detached background process** that survives this shell session.

```bash
nohup autotask $ARGUMENTS >> .dev-loop.log 2>&1 & echo "autotask started (pid=$!), logs: .dev-loop.log"
```

If `autotask` is not in PATH, use the full path:
```bash
nohup /root/.bun/bin/bun run /root/work/autotask/src/loop.ts $ARGUMENTS >> .dev-loop.log 2>&1 & echo "autotask started (pid=$!), logs: .dev-loop.log"
```

- No argument: run indefinitely until review agent stops the loop
- Pass a number to limit iterations, e.g. `/dev:loop 10`
- `--resume-from=review`: skip iteration agent on first round, go straight to review (use when iteration completed but review never ran)
- `--resume-from=iter`: start from iteration agent as normal (default behavior, explicit)

Monitor: `tail -f .dev-loop.log`
Stop: `rm .dev-loop`
