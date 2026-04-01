/**
 * dev loop — spawn iteration agent, then review agent, repeat.
 *
 * Control:
 *   .dev-loop file exists → keep running
 *   review agent deletes .dev-loop → stop
 *   user deletes .dev-loop → stop
 *
 * Prompts are in dev-loop.md and dev-review.md. Agents read everything themselves.
 */

import { spawn } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const ROOT = resolve(import.meta.dir, "..")
const LOOP_FILE = resolve(ROOT, ".dev-loop")
const TRACE_FILE = resolve(ROOT, ".dev-trace.txt")
const ITERATION_PROMPT = resolve(ROOT, "dev-loop.md")
const REVIEW_PROMPT = resolve(ROOT, "dev-review.md")

async function main() {
	const maxIterations = process.argv[2] ? parseInt(process.argv[2], 10) : Infinity

	// Create the loop file — this is the "on" switch
	await writeFile(LOOP_FILE, `started: ${new Date().toISOString()}\n`)
	log("Loop started. Delete .dev-loop to stop.")

	let iteration = 0

	while (await exists(LOOP_FILE) && iteration < maxIterations) {
		iteration++
		log(`--- Iteration ${iteration} ---`)

		// 1. Run iteration agent
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
