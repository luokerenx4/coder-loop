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
 */

import { spawn } from "node:child_process"
import { appendFile, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

// Prompts ship with this package
const PKG_ROOT = resolve(import.meta.dir, "..")
const ITERATION_PROMPT = resolve(PKG_ROOT, "dev-iter.md")
const REVIEW_PROMPT = resolve(PKG_ROOT, "dev-review.md")

// Working files live in the target project (cwd)
const CWD = process.cwd()
const LOOP_FILE = resolve(CWD, ".dev-loop")
const TRACE_FILE = resolve(CWD, ".dev-trace.txt")

const EXCLUDE_ENTRIES = [".dev-loop", ".dev-trace.txt"]

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

	await ensureGitExclude()

	// Create the loop file — this is the "on" switch
	await writeFile(LOOP_FILE, `started: ${new Date().toISOString()}\n`)
	log("Loop started. Delete .dev-loop to stop.")

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
			const iterPrompt = await readFile(ITERATION_PROMPT, "utf-8")
			const { output: iterTrace, code: iterCode } = await runAgent(iterPrompt)
			await writeFile(TRACE_FILE, iterTrace)

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
		const reviewPromptRaw = await readFile(REVIEW_PROMPT, "utf-8")
		const reviewPrompt = reviewPromptRaw
			.replaceAll("{{TRACE_FILE}}", TRACE_FILE)
			.replaceAll("{{LOOP_FILE}}", LOOP_FILE)
		const { output: _, code: reviewCode } = await runAgent(reviewPrompt)

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

	log("Loop ended.")
}

async function runAgent(prompt: string): Promise<{ output: string; code: number }> {
	return new Promise((resolve) => {
		const child = spawn("claude", ["--dangerously-skip-permissions", "-p", prompt], {
			stdio: ["ignore", "pipe", "pipe"],
		})

		const out: Buffer[] = []
		const err: Buffer[] = []
		child.stdout.on("data", (c: Buffer) => out.push(c))
		child.stderr.on("data", (c: Buffer) => err.push(c))

		child.on("close", (code) => {
			const stdout = Buffer.concat(out).toString("utf-8")
			const stderr = Buffer.concat(err).toString("utf-8")
			resolve({ output: stdout + "\n" + stderr, code: code ?? 1 })
		})
	})
}

async function exists(path: string): Promise<boolean> {
	return Bun.file(path).exists()
}

function log(msg: string): void {
	console.error(`[${new Date().toISOString().slice(11, 19)}] ${msg}`)
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
