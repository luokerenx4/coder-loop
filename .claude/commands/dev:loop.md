# /dev:loop — Start the dev loop

Run the orchestrator to start the iteration loop in the current project.

```bash
autotask $ARGUMENTS
```

- No argument: run indefinitely until review agent stops the loop
- Pass a number to limit iterations, e.g. `/dev:loop 10`

The loop alternates between the iteration agent and the review agent. Delete `.dev-loop` at any time to stop.
