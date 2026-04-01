# /dev:loop — Start the dev loop

This is a long-running background task. Run the command with NO timeout (or maximum timeout if none is not possible: 600000ms).

```bash
autotask $ARGUMENTS || /root/.bun/bin/bun run /root/work/autotask/src/loop.ts $ARGUMENTS
```

- No argument: run indefinitely until review agent stops the loop
- Pass a number to limit iterations, e.g. `/dev:loop 10`

The loop alternates between the iteration agent and the review agent. Delete `.dev-loop` at any time to stop.
