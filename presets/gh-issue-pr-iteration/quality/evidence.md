# Quality: evidence

Evidence-truthfulness rules shared by every step. Section A binds executors (referenced from step task files). Section B binds orchestrators (referenced from step accept files). The same rule set, two enforcement points.

## A. Pre-execution constraints (executors)

- **Real path only.** Evidence must come from the real system: real dev server, real CLI invocation, real browser session, real service, real DB. Mocks, stubs, fakes, in-memory substitutes, and recorded replays never count as end-to-end evidence. If the real path cannot run (missing service, credentials, environment), record the exact command, failure mode, exit status, and log excerpt as a blocker in your report — do not substitute a weaker path and present it as the real one.
- **Log evidence is text.** Command output, test results, build logs, and runtime logs go into evidence as text: command + exit status + concise excerpt or path to the full log. Do not screenshot terminal output or locally rendered logs.
- **Screenshots show the real system.** A valid screenshot captures the actual running dev server, CI dashboard, service UI, or deployed page. Never create a local HTML file that renders logs/data/test results and screenshot it — synthetic screenshots are worthless and will be rejected. After capturing, verify the file exists under a tracked `screenshots/` path and opens as image data; record both the local path and the repository-relative path.
- **CI parity.** Detect project CI configuration first. For GitHub Actions jobs reproducible locally, run the relevant job with `act`, deriving workflow path, event, job, and runner architecture from the project; prefer native architecture and record any amd64 caveat. If local CI-parity cannot run (Docker, act install, image pull, network, runner tooling), record the exact command, failure mode, exit status, and log excerpt as an infrastructure blocker. Never silently skip CI-parity; never substitute remote PR checks for it.
- **Positive and negative paths.** When the issue scope or target workflow requires it, capture both the path that should now succeed and the path that should now be rejected/fail.
- **Long-running processes.** Start servers/services with an explicit background + PID + log pattern. Every process you start and every temp file you write outside the evidence directory must be listed in your report's problems/side-effects section — the orchestrator cleans up from that list.
- **Artifacts land in the evidence directory.** Save command logs, screenshots, and other artifacts under the run's evidence directory so they survive your process exit and are citable by path.

## B. Acceptance judgment (orchestrators)

Judge an executor report against these criteria. Any miss is a gap to send back; do not rationalize.

- **Claim ↔ observation.** Every claim of success must map to an actually-executed command with exit status and output (or an artifact). A claim without its observation is a gap, not a formality.
- **Weak signals are not acceptance.** Bare status bits (`is-active: active`, HTTP 200 without body analysis), framework completion lines (`Apply complete!`, `Build succeeded`), whole-suite pass counts, and type-check/build success prove tooling ran — not that the issue's behavior holds on the real path. They may support Layer 2 style landing checks; they never satisfy end-to-end behavior.
- **Synthetic evidence is rejected.** Screenshots of locally rendered HTML/logs/data; text that should have been pasted but was screenshotted; evidence whose content could have been produced without the real system running.
- **Mapping required.** Each artifact or log excerpt must be tied to the specific behavior or acceptance row it proves. An unmapped pile of logs is not an evidence packet.
- **Inspectability.** Evidence that is missing, stale (only exists on main / deleted branches), local-only when review must consume it from GitHub, or impossible to open is insufficient — regardless of how plausible the surrounding prose is.
- **Real-path substitution check.** If the report admits the real path was not exercised (see section A), the corresponding acceptance rows are unmet, no matter how complete the rest of the packet looks.
