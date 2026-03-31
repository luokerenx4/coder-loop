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

const LOOP_FILE = ".dev-loop"
const TRACE_FILE = ".dev-trace.txt"
const ROOT = resolve(import.meta.dir, "..")
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
		const iterTrace = await runAgent(iterPrompt)
		await writeFile(TRACE_FILE, iterTrace)

		// If loop file was deleted during iteration, stop
		if (!(await exists(LOOP_FILE))) {
			log("Loop file removed during iteration. Stopping.")
			break
		}

		// 2. Run review agent — it reads the trace file itself
		const reviewPrompt = await readFile(REVIEW_PROMPT, "utf-8")
		await runAgent(reviewPrompt)

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

async function runAgent(prompt: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn("claude", ["-p", prompt], {
			stdio: ["ignore", "pipe", "pipe"],
		})

		const out: Buffer[] = []
		const err: Buffer[] = []
		child.stdout.on("data", (c: Buffer) => out.push(c))
		child.stderr.on("data", (c: Buffer) => err.push(c))

		child.on("close", (code) => {
			const stdout = Buffer.concat(out).toString("utf-8")
			const stderr = Buffer.concat(err).toString("utf-8")

			if (code !== 0) {
				log(`Agent exited ${code}: ${stderr.slice(0, 200)}`)
			}

			// Return full output as trace regardless of exit code
			resolve(stdout + "\n" + stderr)
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
