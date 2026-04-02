# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

autotask — 无人值守开发循环框架。给定设计文档，自动转化为 checkpoint 驱动的 GitHub issues，然后交替运行 iteration agent（实现）和 review agent（验证）直到任务完成。

## Commands

- **Type check**: `bun run typecheck` (alias for `bun x tsc --noEmit`)
- **Run orchestrator**: `bun run src/loop.ts [maxIter] [--resume-from=iter|review]`
- **Plan phase**: `/dev:plan` (读取设计文档，生成 GitHub issues + CLAUDE.md)
- **Loop phase**: `/dev:loop [N]` (启动迭代循环，默认无限)

No test suite or linter — verification happens through checkpoint execution in target projects.

## Architecture

Three-phase signal pipeline: `plan → iter → review`

```
/dev:plan (design doc → GitHub issues with checkpoint tables)
    ↓
src/loop.ts (state machine orchestrator)
    ├→ spawn iteration agent (dev-iter.md) → implement + execute checkpoints
    ├→ write output to .dev-trace.txt
    ├→ spawn review agent (dev-review.md) → audit trace, post feedback to issue
    └→ repeat until issue closed or .dev-loop deleted
```

**Orchestrator** (`src/loop.ts`): Pure state machine. Creates `.dev-loop` as on-switch, alternates spawning `claude -p` with iteration/review prompts. All business state lives in GitHub issues — agents are stateless and read issue context from scratch each round.

**Agent communication**: No shared memory. Iteration agent writes checkpoint results to `.dev-trace.txt`. Review agent reads trace, posts feedback as issue comments. Next iteration agent reads those comments.

## Key Design Concepts

**Checkpoint 4-tuples**: Each acceptance criterion compiles to `{dimension, command, env, expect}` — executable, not natural language. Agents can't skip or fake execution.

**Dimensional coverage**: Checkpoints must cover all relevant dimensions (function / environment / integration / assumption). Review agent verifies per-dimension coverage.

**Spike issues**: Risky third-party assumptions get a spike issue before implementation. Spike failure → design question, not wasted implementation.

**Inherited verification obligations**: Checkpoints that can't run in current environment are deferred to a downstream issue. Cannot be deferred twice.

## Agent Cognitive Design Principles

以下原则来自对 LLM agent 可靠性的学术研究和 Anthropic 工程实践的系统性分析。

### 1. Agent 无状态，Ground Truth 在 GitHub

每次 `claude -p` spawn 的 agent 是无状态的——没有跨轮次的记忆。所有持久化状态必须存在于 GitHub issues/labels/comments 中，不依赖本地文件。Agent 每轮从 GitHub 实时查询全局状态，用完即丢。

### 2. 关键决策需要完整的认知框架

LLM 遵循结构化流程（Procedure）比遵循模糊目标（Goal）更可靠。系统中最关键的决策必须获得最详细的认知支撑——思维链、证据要求、子步骤分解。一句话的指令（"verify no open issues → stop"）会导致 Goal Substitution：agent 用简单启发式替代指定验证步骤。

### 3. Goal Substitution 是 LLM 的系统性行为

Agent 不是"不懂指令"，而是在执行时选择认知负担更低的路径（Satisficing）。这不可通过 prompt 措辞改善解决，需要通过认知架构设计解决——改变工作流程使得"跳过步骤"比"执行步骤"的认知成本更高。

### 4. 决策 = 证据的推论，不是独立判断

关键决策（如终止循环）不应是 agent 的自由裁量判断，而应是外部状态的机械推论。Agent 查询 `gh issue list`、建分类表、按机械规则得出结论。判断力用于分类每个 issue 的状态，而非直接判断"是否应该停止"。

### 5. 外部化状态 > 内部推理

Agent 把中间状态写到外部（issue comments、分类表）比"记住"状态可靠得多。上下文窗口是流式的——早期信息被后续内容淹没。关键证据必须在决策点被显式重新获取，而非依赖"之前看过"。

### 6. Poka-yoke（防错）优于 Prompt 改进

改善 agent 可靠性的最有效手段不是写更好的 prompt，而是设计更好的工作流程使犯错更难。结构化的 Step 7（实时查询 → 分类表 → 元认知检查 → 机械规则）比一句"verify no open issues"可靠，因为跳过任何一个显式步骤的认知成本高于执行它。

### 7. 认知隔离：高层决策与低层执行分离

高层战略决策（终止循环）和低层执行操作（审计代码、merge PR）不应混在同一个认知流中。低层操作消耗认知资源后，高层决策退化为简单启发式（Decision Fatigue）。关键决策需要独立的认知空间——"清空思维，重新开始"。

## Tech Stack

Bun + TypeScript (strict, ESM). No runtime dependencies. Requires `claude` CLI and `gh` CLI on PATH.

## Conventions

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`
- Cross-repo refs in commit body: `Closes owner/repo#N`
