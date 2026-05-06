#!/usr/bin/env bun
/**
 * coder-loop — stateful issue queue, stateless agents.
 *
 * The orchestrator owns scheduling only:
 *   state queue → fresh iteration agent → trace → fresh review agent → repeat
 *
 * Review is mandatory after every iteration and owns acceptance/retry/stop.
 */

import { spawn } from "node:child_process"
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { createWriteStream, type WriteStream } from "node:fs"
import { isAbsolute, resolve } from "node:path"

const PKG_ROOT = resolve(import.meta.dir, "..")
const ITERATION_PROMPT = resolve(PKG_ROOT, "dev-iter.md")
const REVIEW_PROMPT = resolve(PKG_ROOT, "dev-review.md")

const DEFAULT_CONFIG_FILE = ".coder-loop/config.json"
const DEFAULT_WORKFLOW_FILE = ".coder-loop/workflow.md"
const DEFAULT_SHARED_FILE = ".coder-loop/shared.md"
const DEFAULT_STATE_FILE = ".coder-loop/state.json"
const DEFAULT_ISSUE_DIR = ".coder-loop/issues"
const DEFAULT_EVIDENCE_DIR = ".coder-loop/evidence"
const DEFAULT_LOG_DIR = ".coder-loop/logs"

const EXCLUDE_ENTRIES = [".dev-loop", ".dev-trace.txt", ".coder-loop"]
const QUEUE_STATUSES = [
	"queued",
	"in_progress",
	"changes_requested",
	"blocked",
	"moot",
	"done",
] as const
const ACTIONABLE_STATUSES = ["queued", "in_progress", "changes_requested"] as const

let logStream: WriteStream | null = null

type QueueStatus = (typeof QUEUE_STATUSES)[number]
type ActionableStatus = (typeof ACTIONABLE_STATUSES)[number]
type LoopPhase = "iteration" | "review"
type AgentLabel = "iter" | "review"

type QueueItem = {
	issue: number
	status: QueueStatus
	attempts: number
	title: string
	priority: string
	branch: string | null
	pr: number | null
	lastRunId: string | null
	issueFile: string
	evidenceDir: string
}

type CurrentRun = {
	issue: number
	phase: LoopPhase
	runId: string
	startedAt: string
}

type LoopState = {
	version: number
	queue: QueueItem[]
	repository: string
	baseBranch: string
	recentRuns: unknown[]
	current: CurrentRun | null
}

type RawArgs = {
	maxIterations: number | null
	targetCwd: string | null
	configPath: string | null
	workflowPath: string | null
	statePath: string | null
	repository: string | null
	requireBrowserEvidence: boolean | null
	once: boolean
	dryRun: boolean
}

type LoopConfig = {
	repository: string | null
	baseBranch: string | null
	workflowFile: string | null
	sharedContextFile: string | null
	stateFile: string | null
	issueDir: string | null
	evidenceDir: string | null
	logDir: string | null
	requireAgentBrowserScreenshots: boolean | null
	claudeBinary: string | null
	claudeExtraArgs: string[]
}

type LoopOptions = {
	targetCwd: string
	configPath: string
	workflowPath: string
	sharedContextPath: string
	statePath: string
	issueDir: string
	evidenceRootDir: string
	logDir: string
	loopFile: string
	traceFile: string
	logFile: string
	repository: string
	baseBranch: string
	requireBrowserEvidence: boolean
	claudeBinary: string
	claudeExtraArgs: string[]
	maxIterations: number
	dryRun: boolean
}

type SelectedIssue = {
	item: QueueItem
	issueFile: string
	evidenceDir: string
}

type IssueRunContext = {
	mode: "fresh" | "retry" | "resume-iteration" | "resume-review"
	previousRunId: string | null
	startedAt: string | null
	branch: string | null
	pr: number | null
	status: QueueStatus | null
}

type RenderContext = {
	issue: string
	runId: string
	currentIssueFile: string
	evidenceDir: string
	issueRun: IssueRunContext
}

function parseArgs(): RawArgs {
	const raw: RawArgs = {
		maxIterations: null,
		targetCwd: null,
		configPath: null,
		workflowPath: null,
		statePath: null,
		repository: null,
		requireBrowserEvidence: null,
		once: false,
		dryRun: false,
	}

	const args = process.argv.slice(2)
	for (let index = 0; index < args.length; index++) {
		const arg = args[index]
		if (arg === undefined) fail(`Missing argument at index ${index}`)
		if (/^\d+$/.test(arg)) {
			raw.maxIterations = parseInt(arg, 10)
			continue
		}

		const [name, inlineValue] = splitFlag(arg)
		switch (name) {
			case "--target-cwd":
				raw.targetCwd = readFlagValue(args, index, inlineValue, name)
				if (inlineValue === null) index++
				break
			case "--config":
				raw.configPath = readFlagValue(args, index, inlineValue, name)
				if (inlineValue === null) index++
				break
			case "--workflow":
				raw.workflowPath = readFlagValue(args, index, inlineValue, name)
				if (inlineValue === null) index++
				break
			case "--state":
				raw.statePath = readFlagValue(args, index, inlineValue, name)
				if (inlineValue === null) index++
				break
			case "--repo":
				raw.repository = readFlagValue(args, index, inlineValue, name)
				if (inlineValue === null) index++
				break
			case "--require-browser-evidence":
				rejectInlineValue(inlineValue, name)
				raw.requireBrowserEvidence = true
				break
			case "--once":
				rejectInlineValue(inlineValue, name)
				raw.once = true
				break
			case "--dry-run":
				rejectInlineValue(inlineValue, name)
				raw.dryRun = true
				break
			default:
				fail(`Unknown argument: ${arg}`)
		}
	}

	return raw
}

function splitFlag(arg: string): [string, string | null] {
	const equalsIndex = arg.indexOf("=")
	if (equalsIndex === -1) return [arg, null]
	return [arg.slice(0, equalsIndex), arg.slice(equalsIndex + 1)]
}

function readFlagValue(args: string[], index: number, inlineValue: string | null, name: string): string {
	if (inlineValue !== null) return inlineValue
	const value = args[index + 1]
	if (value === undefined || value.startsWith("--")) fail(`Missing value for ${name}`)
	return value
}

function rejectInlineValue(value: string | null, name: string): void {
	if (value !== null) fail(`${name} does not accept a value`)
}

async function main() {
	const rawArgs = parseArgs()
	const targetCwd = resolve(rawArgs.targetCwd ?? process.cwd())
	const configPath = resolveFrom(targetCwd, rawArgs.configPath ?? DEFAULT_CONFIG_FILE)
	const config = await loadConfig(configPath)
	const options = buildOptions(targetCwd, configPath, rawArgs, config)

	await ensureRuntime(options)

	if (options.dryRun) {
		const state = await loadState(options.statePath)
		const selected = selectIssue(state, options)
		console.error(`Dry run: target=${options.targetCwd}`)
		console.error(`Dry run: repo=${options.repository}`)
		console.error(`Dry run: workflow=${options.workflowPath}`)
		console.error(`Dry run: state=${options.statePath}`)
		console.error(`Dry run: selected=${selected ? `#${selected.item.issue}` : "none"}`)
		return
	}

	logStream = createWriteStream(options.logFile, { flags: "a" })
	log(`=== coder-loop started (pid=${process.pid}, cwd=${options.targetCwd}) ===`)
	log(`Config: maxIterations=${formatMaxIterations(options.maxIterations)}`)
	log(`Repo=${options.repository}`)
	log(`Prompt files: iter=${ITERATION_PROMPT}, review=${REVIEW_PROMPT}`)
	log(`Workflow=${options.workflowPath}`)
	log(`State=${options.statePath}`)

	await ensureGitExclude(options.targetCwd)
	await writeFile(
		options.loopFile,
		`started: ${new Date().toISOString()}\npid: ${process.pid}\nlog: ${options.logFile}\ncwd: ${options.targetCwd}\nstate: ${options.statePath}\n`,
	)
	log("Loop file created. Delete .dev-loop to stop.")

	let iteration = 0

	while ((await exists(options.loopFile)) && iteration < options.maxIterations) {
		iteration++
		log(`--- Iteration ${iteration} ---`)

		const state = await loadState(options.statePath)
		const selected = selectIssue(state, options)

		if (!selected) {
			await writeFile(options.traceFile, "No actionable issue found in .coder-loop/state.json. Review must assess whether to stop.\n")
			log("No actionable issue selected; running review for global state assessment.")
			await runReview(options, {
				issue: "",
				runId: makeRunId(null),
				currentIssueFile: "",
				evidenceDir: options.evidenceRootDir,
				issueRun: { mode: "fresh", previousRunId: null, startedAt: null, branch: null, pr: null, status: null },
			})
			if (!(await exists(options.loopFile))) {
				log("Review agent stopped the loop.")
				break
			}
			log("Review left loop running even though no actionable issue was selected; stopping to avoid a tight loop.")
			break
		}

		const current = state.current?.issue === selected.item.issue ? state.current : null
		const issueRun = makeIssueRunContext(selected.item, current)
		const runId = current?.runId ?? makeRunId(selected.item.issue)
		let context: RenderContext = {
			issue: String(selected.item.issue),
			runId,
			currentIssueFile: selected.issueFile,
			evidenceDir: selected.evidenceDir,
			issueRun,
		}

		if (current?.phase !== "review") {
			const stateForIteration = await loadState(options.statePath)
			markIterationStarted(stateForIteration, selected.item.issue, runId, current === null)
			await saveState(options.statePath, stateForIteration)

			log(`${current ? "Resuming" : "Starting"} iteration agent for issue #${selected.item.issue}...`)
			const iterStart = Date.now()
			const iterPromptRaw = await readFile(ITERATION_PROMPT, "utf-8")
			const iterPrompt = renderPrompt(iterPromptRaw, options, context)
			const iterOutputPath = agentOutputPath(options, runId, "iter")
			const { output: iterTrace, code: iterCode } = await runAgent(options, "iter", iterPrompt, iterOutputPath)
			const iterDuration = ((Date.now() - iterStart) / 1000).toFixed(0)
			await writeFile(options.traceFile, iterTrace)
			await writeFile(iterOutputPath, iterTrace)

			log(`Iteration agent finished: issue=#${selected.item.issue}, exit=${iterCode}, duration=${iterDuration}s, trace=${options.traceFile}, output=${iterOutputPath} (${iterTrace.length} bytes)`)

			if (iterCode !== 0) {
				log(`Iteration agent failed (exit ${iterCode}). Stopping without review or state judgment.`)
				await removeLoopFile(options.loopFile)
				break
			}

			if (!(await exists(options.loopFile))) {
				log("Loop file removed during iteration. Stopping before review.")
				break
			}

			const stateForReview = await loadState(options.statePath)
			markReviewStarted(stateForReview, selected.item.issue, runId)
			await saveState(options.statePath, stateForReview)
					} else {
			log(`Resuming review agent for issue #${selected.item.issue} without rerunning iteration...`)
		}

		const reviewCode = await runReview(options, context)
		if (reviewCode !== 0) {
			log(`Review agent crashed (exit ${reviewCode}). Stopping.`)
			await removeLoopFile(options.loopFile)
			break
		}

		if (!(await exists(options.loopFile))) {
			log("Review agent stopped the loop.")
			break
		}

		log(`Iteration ${iteration} complete.`)
	}

	if (iteration >= options.maxIterations) {
		log(`Reached ${formatMaxIterations(options.maxIterations)} iterations.`)
	}

	log("=== Loop ended. ===")
	logStream?.end()
}

async function runReview(options: LoopOptions, context: RenderContext): Promise<number> {
	log("Starting review agent...")
	const reviewStart = Date.now()
	const reviewPromptRaw = await readFile(REVIEW_PROMPT, "utf-8")
	const reviewPrompt = renderPrompt(reviewPromptRaw, options, context)
	const reviewOutputPath = agentOutputPath(options, context.runId, "review")
	const { output: reviewTrace, code: reviewCode } = await runAgent(options, "review", reviewPrompt, reviewOutputPath)
	const reviewDuration = ((Date.now() - reviewStart) / 1000).toFixed(0)

	await writeFile(reviewOutputPath, reviewTrace)
	log(`Review agent finished: exit=${reviewCode}, duration=${reviewDuration}s, output=${reviewOutputPath} (${reviewTrace.length} bytes)`)
	if (reviewTrace.trim().length > 0) {
		await appendFile(options.logFile, `\n--- review output ${new Date().toISOString()} ---\n${reviewTrace}\n`)
	}
	return reviewCode
}

function buildOptions(targetCwd: string, configPath: string, raw: RawArgs, config: LoopConfig): LoopOptions {
	const workflowPath = resolveFrom(targetCwd, raw.workflowPath ?? config.workflowFile ?? DEFAULT_WORKFLOW_FILE)
	const sharedContextPath = resolveFrom(targetCwd, config.sharedContextFile ?? DEFAULT_SHARED_FILE)
	const statePath = resolveFrom(targetCwd, raw.statePath ?? config.stateFile ?? DEFAULT_STATE_FILE)
	const issueDir = resolveFrom(targetCwd, config.issueDir ?? DEFAULT_ISSUE_DIR)
	const evidenceRootDir = resolveFrom(targetCwd, config.evidenceDir ?? DEFAULT_EVIDENCE_DIR)
	const logDir = resolveFrom(targetCwd, config.logDir ?? DEFAULT_LOG_DIR)
	const repository = raw.repository ?? config.repository
	if (!repository) fail("Repository is required. Set --repo or .coder-loop/config.json repository.")

	const maxIterations = raw.once ? 1 : (raw.maxIterations ?? Number.POSITIVE_INFINITY)
	const requireBrowserEvidence = raw.requireBrowserEvidence ?? config.requireAgentBrowserScreenshots ?? false
	const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")

	return {
		targetCwd,
		configPath,
		workflowPath,
		sharedContextPath,
		statePath,
		issueDir,
		evidenceRootDir,
		logDir,
		loopFile: resolve(targetCwd, ".dev-loop"),
		traceFile: resolve(targetCwd, ".dev-trace.txt"),
		logFile: resolve(logDir, `autotask-${process.pid}.${timestamp}.log`),
		repository,
		baseBranch: config.baseBranch ?? "main",
		requireBrowserEvidence,
		claudeBinary: config.claudeBinary ?? "claude",
		claudeExtraArgs: config.claudeExtraArgs,
		maxIterations,
		dryRun: raw.dryRun,
	}
}

async function loadConfig(path: string): Promise<LoopConfig> {
	const raw = await readFile(path, "utf-8").catch((error: unknown) => {
		if (isNodeError(error) && error.code === "ENOENT") {
			fail(`Missing config file: ${path}`)
		}
		throw error
	})
	const parsed: unknown = JSON.parse(raw)
	const root = expectRecord(parsed, "config")
	const evidence = optionalRecord(root, "evidence")
	const claude = optionalRecord(root, "claude")

	return {
		repository: optionalString(root, "repository"),
		baseBranch: optionalString(root, "baseBranch"),
		workflowFile: optionalString(root, "workflowFile"),
		sharedContextFile: optionalString(root, "sharedContextFile"),
		stateFile: optionalString(root, "stateFile"),
		issueDir: optionalString(root, "issueDir"),
		evidenceDir: optionalString(root, "evidenceDir"),
		logDir: optionalString(root, "logDir"),
		requireAgentBrowserScreenshots: evidence ? optionalBoolean(evidence, "requireAgentBrowserScreenshots") : null,
		claudeBinary: claude ? optionalString(claude, "binary") : null,
		claudeExtraArgs: claude ? (optionalStringArray(claude, "extraArgs") ?? []) : [],
	}
}

async function ensureRuntime(options: LoopOptions): Promise<void> {
	await assertReadable(options.workflowPath, "workflow")
	await assertReadable(options.sharedContextPath, "shared context")
	await assertReadable(options.statePath, "state")
	await mkdir(options.logDir, { recursive: true })
}

async function assertReadable(path: string, label: string): Promise<void> {
	try {
		await readFile(path, "utf-8")
	} catch (error) {
		if (isNodeError(error) && error.code === "ENOENT") fail(`Missing ${label} file: ${path}`)
		throw error
	}
}

async function loadState(path: string): Promise<LoopState> {
	const raw = await readFile(path, "utf-8")
	const parsed: unknown = JSON.parse(raw)
	const root = expectRecord(parsed, "state")
	const queueValue = root.queue
	if (!Array.isArray(queueValue)) fail("state.queue must be an array")

	return {
		version: requiredNumber(root, "version"),
		queue: queueValue.map((item, index) => parseQueueItem(item, `state.queue[${index}]`)),
		repository: optionalString(root, "repository") ?? "",
		baseBranch: optionalString(root, "baseBranch") ?? "main",
		recentRuns: Array.isArray(root.recentRuns) ? root.recentRuns : [],
		current: parseCurrent(root.current),
	}
}

function parseQueueItem(value: unknown, label: string): QueueItem {
	const record = expectRecord(value, label)
	return {
		issue: requiredNumber(record, "issue"),
		status: requiredQueueStatus(record, "status"),
		attempts: requiredNumber(record, "attempts"),
		title: requiredString(record, "title"),
		priority: requiredString(record, "priority"),
		branch: nullableString(record, "branch"),
		pr: nullableNumber(record, "pr"),
		lastRunId: nullableString(record, "lastRunId"),
		issueFile: requiredString(record, "issueFile"),
		evidenceDir: requiredString(record, "evidenceDir"),
	}
}

function parseCurrent(value: unknown): CurrentRun | null {
	if (value === undefined || value === null) return null
	const record = expectRecord(value, "state.current")
	return {
		issue: requiredNumber(record, "issue"),
		phase: requiredLoopPhase(record, "phase"),
		runId: requiredString(record, "runId"),
		startedAt: requiredString(record, "startedAt"),
	}
}

async function saveState(path: string, state: LoopState): Promise<void> {
	await writeFile(path, `${JSON.stringify(state, null, "\t")}\n`)
}

function selectIssue(state: LoopState, options: LoopOptions): SelectedIssue | null {
	const currentItem = state.current ? state.queue.find((item) => item.issue === state.current?.issue) : undefined
	const selected = currentItem && isActionableStatus(currentItem.status)
		? currentItem
		: state.queue.find((item) => isActionableStatus(item.status))
	if (!selected) return null

	return {
		item: selected,
		issueFile: resolveFrom(options.targetCwd, selected.issueFile),
		evidenceDir: resolveFrom(options.targetCwd, selected.evidenceDir),
	}
}

function markIterationStarted(state: LoopState, issue: number, runId: string, countAttempt: boolean): void {
	const item = state.queue.find((entry) => entry.issue === issue)
	if (!item) fail(`Selected issue #${issue} not found in state queue`)
	item.status = "in_progress"
	if (countAttempt) item.attempts += 1
	item.lastRunId = runId
	state.current = { issue, phase: "iteration", runId, startedAt: new Date().toISOString() }
}

function markReviewStarted(state: LoopState, issue: number, runId: string): void {
	state.current = { issue, phase: "review", runId, startedAt: new Date().toISOString() }
}

function makeIssueRunContext(item: QueueItem, current: CurrentRun | null): IssueRunContext {
	if (current) {
		return {
			mode: current.phase === "review" ? "resume-review" : "resume-iteration",
			previousRunId: current.runId,
			startedAt: current.startedAt,
			branch: item.branch,
			pr: item.pr,
			status: item.status,
		}
	}

	return {
		mode: item.status === "changes_requested" ? "retry" : "fresh",
		previousRunId: item.lastRunId,
		startedAt: null,
		branch: item.branch,
		pr: item.pr,
		status: item.status,
	}
}

function renderPrompt(template: string, options: LoopOptions, context: RenderContext): string {
	const replacements: Array<[string, string]> = [
		["{{TARGET_CWD}}", options.targetCwd],
		["{{REPO}}", options.repository],
		["{{BASE_BRANCH}}", options.baseBranch],
		["{{RUN_ID}}", context.runId],
		["{{ISSUE}}", context.issue],
		["{{WORKFLOW_FILE}}", options.workflowPath],
		["{{SHARED_CONTEXT_FILE}}", options.sharedContextPath],
		["{{STATE_FILE}}", options.statePath],
		["{{CURRENT_ISSUE_FILE}}", context.currentIssueFile],
		["{{ISSUE_DIR}}", options.issueDir],
		["{{EVIDENCE_DIR}}", context.evidenceDir],
		["{{EVIDENCE_ROOT_DIR}}", options.evidenceRootDir],
		["{{LOG_DIR}}", options.logDir],
		["{{TRACE_FILE}}", options.traceFile],
		["{{LOOP_FILE}}", options.loopFile],
		["{{REQUIRE_BROWSER_EVIDENCE}}", String(options.requireBrowserEvidence)],
		["{{ISSUE_RUN_MODE}}", context.issueRun.mode],
		["{{RECOVERY_MODE}}", context.issueRun.mode],
		["{{PREVIOUS_RUN_ID}}", context.issueRun.previousRunId ?? ""],
		["{{RECOVERY_STARTED_AT}}", context.issueRun.startedAt ?? ""],
		["{{ISSUE_BRANCH}}", context.issueRun.branch ?? ""],
		["{{ISSUE_PR}}", context.issueRun.pr === null ? "" : String(context.issueRun.pr)],
		["{{ISSUE_STATUS}}", context.issueRun.status ?? ""],
	]

	return replacements.reduce((prompt, [placeholder, value]) => prompt.replaceAll(placeholder, value), template)
}

async function runAgent(options: LoopOptions, label: AgentLabel, prompt: string, outputPath: string): Promise<{ output: string; code: number }> {
	return new Promise((resolveResult) => {
		const outputStream = createWriteStream(outputPath, { flags: "a" })
		const child = spawn(options.claudeBinary, [...options.claudeExtraArgs, "-p", prompt], {
			cwd: options.targetCwd,
			stdio: ["ignore", "pipe", "pipe"],
			detached: true,
		})

		log(`Agent [${label}] spawned: pid=${child.pid}, output=${outputPath}`)

		const out: Buffer[] = []
		const err: Buffer[] = []
		let settled = false

		child.stdout.on("data", (chunk: Buffer) => {
			out.push(chunk)
			outputStream.write(chunk)
		})
		child.stderr.on("data", (chunk: Buffer) => {
			err.push(chunk)
			outputStream.write(chunk)
		})

		child.on("error", (error) => {
			if (settled) return
			settled = true
			log(`Agent [${label}] spawn error: ${error.message}`)
			outputStream.end(`\nspawn error: ${error.message}\n`)
			resolveResult({ output: `spawn error: ${error.message}`, code: 1 })
		})

		child.on("close", (code, signal) => {
			if (settled) return
			settled = true
			const stdout = Buffer.concat(out).toString("utf-8")
			const stderr = Buffer.concat(err).toString("utf-8")
			if (signal) log(`Agent [${label}] killed by signal ${signal}`)
			outputStream.end()
			resolveResult({ output: stdout + "\n" + stderr, code: code ?? 1 })
		})
	})
}

async function ensureGitExclude(cwd: string): Promise<void> {
	const excludePath = resolve(cwd, ".git", "info", "exclude")
	try {
		const content = await readFile(excludePath, "utf-8")
		const lines = content.split("\n")
		const missing = EXCLUDE_ENTRIES.filter((entry) => !lines.includes(entry))
		if (missing.length > 0) await appendFile(excludePath, "\n" + missing.join("\n") + "\n")
	} catch {
		// No .git/info/exclude available; non-git targets can still run.
	}
}

function agentOutputPath(options: LoopOptions, runId: string, label: AgentLabel): string {
	return resolve(options.logDir, `${runId}.${label}.txt`)
}

function resolveFrom(base: string, path: string): string {
	return isAbsolute(path) ? path : resolve(base, path)
}

function makeRunId(issue: number | null): string {
	const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")
	return issue === null ? `run-${timestamp}-no-issue` : `run-${timestamp}-issue-${issue}`
}

async function exists(path: string): Promise<boolean> {
	return Bun.file(path).exists()
}

async function removeLoopFile(path: string): Promise<void> {
	try {
		await Bun.file(path).delete()
	} catch (error) {
		if (isNodeError(error) && error.code === "ENOENT") return
		throw error
	}
}

function log(message: string): void {
	const line = `[${new Date().toISOString()}] ${message}`
	console.error(line)
	logStream?.write(line + "\n")
}

function formatMaxIterations(value: number): string {
	return value === Number.POSITIVE_INFINITY ? "Infinity" : String(value)
}

function isActionableStatus(status: QueueStatus): status is ActionableStatus {
	return ACTIONABLE_STATUSES.includes(status as ActionableStatus)
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
	if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>
	fail(`${label} must be an object`)
}

function optionalRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
	const value = record[key]
	if (value === undefined || value === null) return null
	return expectRecord(value, key)
}

function requiredString(record: Record<string, unknown>, key: string): string {
	const value = record[key]
	if (typeof value === "string") return value
	fail(`${key} must be a string`)
}

function optionalString(record: Record<string, unknown>, key: string): string | null {
	const value = record[key]
	if (value === undefined || value === null) return null
	if (typeof value === "string") return value
	fail(`${key} must be a string when provided`)
}

function nullableString(record: Record<string, unknown>, key: string): string | null {
	const value = record[key]
	if (value === null) return null
	if (typeof value === "string") return value
	fail(`${key} must be a string or null`)
}

function requiredNumber(record: Record<string, unknown>, key: string): number {
	const value = record[key]
	if (typeof value === "number" && Number.isFinite(value)) return value
	fail(`${key} must be a finite number`)
}

function nullableNumber(record: Record<string, unknown>, key: string): number | null {
	const value = record[key]
	if (value === null) return null
	if (typeof value === "number" && Number.isFinite(value)) return value
	fail(`${key} must be a finite number or null`)
}

function optionalBoolean(record: Record<string, unknown>, key: string): boolean | null {
	const value = record[key]
	if (value === undefined || value === null) return null
	if (typeof value === "boolean") return value
	fail(`${key} must be a boolean when provided`)
}

function optionalStringArray(record: Record<string, unknown>, key: string): string[] | null {
	const value = record[key]
	if (value === undefined || value === null) return null
	if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) return value
	fail(`${key} must be a string array when provided`)
}

function requiredQueueStatus(record: Record<string, unknown>, key: string): QueueStatus {
	const value = requiredString(record, key)
	if (QUEUE_STATUSES.includes(value as QueueStatus)) return value as QueueStatus
	fail(`${key} has invalid queue status: ${value}`)
}

function requiredLoopPhase(record: Record<string, unknown>, key: string): LoopPhase {
	const value = requiredString(record, key)
	if (value === "iteration" || value === "review") return value
	fail(`${key} must be "iteration" or "review"`)
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return typeof error === "object" && error !== null && "code" in error
}

function fail(message: string): never {
	console.error(message)
	process.exit(1)
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error)
	log(`Fatal: ${message}`)
	logStream?.end()
	process.exit(1)
})
