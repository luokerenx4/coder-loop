# Quality: cleanup

Site-cleanliness rules. Section A binds executors. Section B binds orchestrators, who own the final sweep.

## A. Pre-execution constraints (executors)

- Every process you start (dev server, daemon, watcher, tunnel, container) is started with an explicit background + PID + log pattern, and reported: command, PID, log path.
- Every file you create outside the deliverable (temp scripts, scratch dirs, downloaded artifacts, extra worktrees/branches beyond the issue branch) is reported with its path.
- Stop what you started when your step no longer needs it; whatever you intentionally leave running for a later step, say so explicitly in your report.
- Never stage runtime artifacts, scheduling state, run logs, or local-only evidence into feature commits. Preserve unrelated dirty files you found in the worktree — pre-existing mess is not yours to clean or to commit.

## B. Final sweep (orchestrators)

- Maintain a dispatch ledger across the run: for each dispatched step, record the reported side effects (PIDs, temp paths, branches, background services).
- Before printing the final summary, sweep the ledger: kill remaining PIDs, remove temp files, drop scratch state. Verify the kill took effect (`ps -p <pid>` empty / port no longer listening) rather than assuming.
- Clean means: no processes left running that this run started; no stray files outside the evidence directory and the committed deliverable; evidence artifacts preserved in place; pre-existing dirty state untouched.
- If something cannot be cleaned (e.g. a process owned by another run, a file the environment will not let you remove), record exactly what remains and why in the handoff note — an honest residue line beats a silent leak.
