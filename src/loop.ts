#!/usr/bin/env bun
/**
 * dev loop — spawn iteration agent, then review agent, repeat.
 *
 * Control:
 *   .dev-loop file exists → keep running
 *   review agent deletes .dev-loop → stop
 *   user deletes .dev-loop → stop
 *
 * Usage:
 *   autotask [maxIterations] [--resume-from=iter|review]
 *
 * Prompts are in dev-iter.md and dev-review.md. Agents read everything themselves.
 * Logs are written to .dev-loop.log in the working directory.
 */

import { spawn } from "node:child_process"
import { appendFile, readFile, writeFile } from "node:fs/promises"
import { createWriteStream, type WriteStream } from "node:fs"
import { resolve } from "node:path"

// Prompts ship with this package
const PKG_ROOT = resolve(import.meta.dir, "..")
const ITERATION_PROMPT = resolve(PKG_ROOT, "dev-iter.md")
const REVIEW_PROMPT = resolve(PKG_ROOT, "dev-review.md")

// Working files live in the target project (cwd)
const CWD = process.cwd()
const LOOP_FILE = resolve(CWD, ".dev-loop")
const TRACE_FILE = resolve(CWD, ".dev-trace.txt")
const LOG_FILE = `/tmp/autotask-${process.pid}.${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.log`

const EXCLUDE_ENTRIES = [".dev-loop", ".dev-trace.txt"]

let logStream: WriteStream

async function ensureGitExclude() {
	const excludePath = resolve(CWD, ".git", "info", "exclude")
	try {
		const content = await readFile(excludePath, "utf-8")
		const missing = EXCLUDE_ENTRIES.filter((e) => !content.split("\n").includes(e))
		if (missing.length > 0) {
			await appendFile(excludePath, "\n" + missing.join("\n") + "\n")
		}
	} catch {
		// no .git or no info/exclude — not a git repo or fresh init, skip
	}
}

type ResumeFrom = "iter" | "review"

function parseArgs(): { maxIterations: number; resumeFrom: ResumeFrom | null } {
	let maxIterations = Infinity
	let resumeFrom: ResumeFrom | null = null

	for (const arg of process.argv.slice(2)) {
		if (arg.startsWith("--resume-from=")) {
			const val = arg.slice("--resume-from=".length)
			if (val !== "iter" && val !== "review") {
				console.error(`Invalid --resume-from value: ${val}. Use "iter" or "review".`)
				process.exit(1)
			}
			resumeFrom = val
		} else if (/^\d+$/.test(arg)) {
			maxIterations = parseInt(arg, 10)
		}
	}

	return { maxIterations, resumeFrom }
}

async function main() {
	const { maxIterations, resumeFrom } = parseArgs()

	// Open log file (append mode)
	logStream = createWriteStream(LOG_FILE, { flags: "a" })

	log(`=== autotask started (pid=${process.pid}, cwd=${CWD}) ===`)
	log(`Config: maxIterations=${maxIterations}, resumeFrom=${resumeFrom ?? "default"}`)
	log(`Prompts: iter=${ITERATION_PROMPT}, review=${REVIEW_PROMPT}`)

	await ensureGitExclude()

	// Create the loop file — this is the "on" switch
	await writeFile(LOOP_FILE, `started: ${new Date().toISOString()}\npid: ${process.pid}\nlog: ${LOG_FILE}\ncwd: ${CWD}\n`)
	log("Loop file created. Delete .dev-loop to stop.")

	let iteration = 0
	let skipIter = resumeFrom === "review"

	while ((await exists(LOOP_FILE)) && iteration < maxIterations) {
		iteration++
		log(`--- Iteration ${iteration} ---`)

		// 1. Run iteration agent (skip on first iteration if resuming from review)
		if (skipIter) {
			log("Resuming from review — skipping iteration agent.")
			skipIter = false
		} else {
			log("Starting iteration agent...")
			const iterStart = Date.now()
			const iterPrompt = await readFile(ITERATION_PROMPT, "utf-8")
			const { output: iterTrace, code: iterCode } = await runAgent("iter", iterPrompt)
			const iterDuration = ((Date.now() - iterStart) / 1000).toFixed(0)
			await writeFile(TRACE_FILE, iterTrace)

			log(`Iteration agent finished: exit=${iterCode}, duration=${iterDuration}s, trace=${TRACE_FILE} (${iterTrace.length} bytes)`)

			if (iterCode !== 0) {
				log(`Iteration agent crashed (exit ${iterCode}). Letting review decide.`)
			}

			// If loop file was deleted during iteration, stop
			if (!(await exists(LOOP_FILE))) {
				log("Loop file removed during iteration. Stopping.")
				break
			}
		}

		// 2. Run review agent — it reads the trace file itself
		log("Starting review agent...")
		const reviewStart = Date.now()
		const reviewPromptRaw = await readFile(REVIEW_PROMPT, "utf-8")
		const reviewPrompt = reviewPromptRaw
			.replaceAll("{{TRACE_FILE}}", TRACE_FILE)
			.replaceAll("{{LOOP_FILE}}", LOOP_FILE)
		const { output: reviewTrace, code: reviewCode } = await runAgent("review", reviewPrompt)
		const reviewDuration = ((Date.now() - reviewStart) / 1000).toFixed(0)

		log(`Review agent finished: exit=${reviewCode}, duration=${reviewDuration}s, output=${reviewTrace.length} bytes`)

		if (reviewCode !== 0) {
			log(`Review agent crashed (exit ${reviewCode}). Stopping.`)
			break
		}

		// Review agent decides: delete .dev-loop → stop, leave it → continue
		if (!(await exists(LOOP_FILE))) {
			log("Review agent stopped the loop.")
			break
		}

		log(`Iteration ${iteration} complete.`)
	}

	if (iteration >= maxIterations) {
		log(`Reached ${maxIterations} iterations.`)
	}

	log("=== Loop ended. ===")
	logStream.end()
}

async function runAgent(label: string, prompt: string): Promise<{ output: string; code: number }> {
	return new Promise((resolve) => {
		const child = spawn("claude", ["--dangerously-skip-permissions", "-p", prompt], {
			cwd: CWD,
			stdio: ["ignore", "pipe", "pipe"],
			detached: true,
		})

		log(`Agent [${label}] spawned: pid=${child.pid}`)

		const out: Buffer[] = []
		const err: Buffer[] = []
		child.stdout.on("data", (c: Buffer) => out.push(c))
		child.stderr.on("data", (c: Buffer) => err.push(c))

		child.on("error", (e) => {
			log(`Agent [${label}] spawn error: ${e.message}`)
			resolve({ output: `spawn error: ${e.message}`, code: 1 })
		})

		child.on("close", (code, signal) => {
			const stdout = Buffer.concat(out).toString("utf-8")
			const stderr = Buffer.concat(err).toString("utf-8")
			if (signal) {
				log(`Agent [${label}] killed by signal ${signal}`)
			}
			resolve({ output: stdout + "\n" + stderr, code: code ?? 1 })
		})
	})
}

async function exists(path: string): Promise<boolean> {
	return Bun.file(path).exists()
}

function log(msg: string): void {
	const line = `[${new Date().toISOString()}] ${msg}`
	console.error(line)
	logStream?.write(line + "\n")
}

main().catch((e) => {
	log(`Fatal: ${e.message}\n${e.stack}`)
	logStream?.end()
	process.exit(1)
})
