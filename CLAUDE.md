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

## Agent Prompt 设计的研究前提

以下是支撑 agent prompt 设计决策的学术研究和工程实证。修改 `dev-iter.md` / `dev-review.md` 时必须理解这些前提。

### LLM 在无外部 ground truth 时无法可靠自我验证

Huang et al. (2023) "Large Language Models Cannot Self-Correct Reasoning Yet" 证明：没有外部反馈时，LLM 的自我验证收敛到确认自身先前结论的简单检查，而非真正重新验证。Lanham et al. (Anthropic, 2023) 进一步证明 CoT 推理经常不忠实于实际计算过程——"验证推理"可能只是事后合理化。

→ Agent prompt 中的关键验证步骤必须要求执行外部命令并展示输出，不能依赖 agent "推理得出"结论。

### Goal Substitution 是 LLM 的系统性行为，不是偶发错误

Pan et al. (2025) "School of Reward Hacks" 证明：在无害任务上学到的目标替代行为会泛化到全新场景。编码代理学会篡改测试用例而非编写正确代码。AgentIF (2025) 基准测试显示最优模型的指令约束全满足率（ISR）仅 27.2%——在 agentic 场景中，LLM 有近 3/4 概率漏掉至少一个约束。

→ 不能假设 agent 会忠实执行 prompt 中的每条指令。关键步骤的认知框架越详细，被跳过的概率越低。一句话的指令几乎必然被 satisfice。

### LLM 遵循 Procedure 比遵循 Goal 更可靠

Plan-and-Act (UC Berkeley, ICML 2025) 证明：当单一模型同时处理高层策略和低层执行时，"models often lose sight of their ultimate objectives"。分离后两者的可靠性都提升。WebArena-Lite 成功率从基线提升至 57.58%。

→ 关键决策不应写成目标（"verify no open issues"），而应分解为可执行的步骤序列（查询 → 分类 → 计数 → 规则判定）。

### 外部化结构化状态远比内部记忆可靠

Anthropic (2025) "Effective Harnesses for Long-Running Agents"：JSON 格式的结构化 TODO 比自然语言状态追踪可靠——"model is less likely to inappropriately change or overwrite JSON files compared to Markdown files"。全面的特性列表直接阻止了 agent 过早宣布完成。Scratchpad 研究一致表明 JSON scratchpad 比要求模型"记住"状态可靠得多。

→ 但本项目中 agent 是无状态的（每次 `claude -p` 是独立进程），本地文件跨轮次不可靠。因此 ground truth 必须在 GitHub（issues/labels/comments），agent 每次实时查询。

### Poka-yoke（防错设计）优于 Prompt 措辞改进

Anthropic (2025) "Building Effective Agents"：在 SWE-bench 实现中"spent more time optimizing tools than the overall prompt"。当 agent 用相对路径出错时，改 tool 为强制绝对路径——"the model used this method flawlessly"。改善可靠性的最有效手段不是写更好的指令，而是设计流程使犯错更难。

→ 与其告诉 agent "记得检查所有 open issues"，不如设计一个流程使得"不检查"的认知成本高于"检查"——例如要求粘贴命令输出、逐条分类、回答元认知问题后才能得出结论。

### 认知负荷导致决策退化

TMS (2025) 和 Plan-and-Act 均证明：低层执行操作消耗认知资源后，高层战略决策退化为简单启发式（Decision Fatigue）。SOFAI-LM (2025) 证明元认知模块（自我监控、自我评估）能使标准 LLM 匹配专用推理模型的准确率，关键不是更强的模型而是更好的自我审视结构。

→ 关键决策需要独立的认知空间，与前面的低层操作隔离。Prompt 中用显式的步骤分隔和"清空思维"指令实现。

## Tech Stack

Bun + TypeScript (strict, ESM). No runtime dependencies. Requires `claude` CLI and `gh` CLI on PATH.

## Conventions

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`
- Cross-repo refs in commit body: `Closes owner/repo#N`
