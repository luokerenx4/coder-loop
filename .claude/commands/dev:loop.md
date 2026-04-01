# /dev:loop — Start the dev loop

Run the orchestrator to start the iteration loop.

```bash
bun run loop $ARGUMENTS
```

- No argument: run indefinitely until review agent stops the loop
- Pass a number to limit iterations, e.g. `/dev:loop 10`

The loop alternates between the iteration agent (`dev-iter.md`) and the review agent (`dev-review.md`). Delete `.dev-loop` at any time to stop.
