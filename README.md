# autotask

无人值守开发循环。给定一份设计文档，自动把它变成 GitHub PR，持续迭代直到完成。

## 设计思想

### 核心模型：信号生成 → 信号产生 → 信号消费

autotask 本质上是一个迭代收敛系统。它能否收敛到正确结果，取决于每次迭代是否产生足够的**信号**来驱动下一次迭代的方向。

这个认识来自 2024-2025 年四组研究的共同发现：

| 问题 | 研究 | 发现 |
|---|---|---|
| 迭代系统为什么不收敛？ | ReVeal (2025), VeRPO (2025), DynaFix (2025) | binary pass/fail 是 sparse reward，无法指导迭代方向；dense per-step signal 使收敛效率提升 10%-37% |
| 评估为什么漏判？ | EDDOps (2024), Beyond Task Completion (2024) | 单维度评估掩盖其他维度的缺陷；agent 可在功能维度 100% 通过但策略维度仅 33% |
| 任务分解为什么导致失败？ | Agent Failure Taxonomy (2025) | planning phase defects 是 agent 任务失败的首要类别（约 50% 的失败源于此） |
| 怎么防止无限低质量推进？ | VMAO (2025) | completeness threshold + diminishing returns 检测 |

基于这些发现，autotask 将迭代系统的职责拆分为三个独立环节：

```
plan（信号结构定义）→ iter（信号产生）→ review（信号消费与判定）
```

- **plan** 定义"要检查什么"——将验收标准编译为带维度标注的可执行 checkpoint 序列
- **iter** 产生信号——执行 checkpoint 命令，报告每个 checkpoint 的 pass/fail 及实际输出
- **review** 消费信号并判定——审计 checkpoint 执行结果，检查维度覆盖，决定迭代方向

### 四个设计决策

**1. Checkpoint 取代 checkbox**

传统做法是在 issue 中写 `- [ ] docker build 成功`。这是自然语言描述，不是可执行的验证。iteration agent 可以跳过它、重新解释它、或声称完成了它。

autotask 的 plan 将每条验收标准编译为 `{dimension, command, env, expect}` 四元组。iteration agent 无法"跳过"一个有具体 SSH 命令的 checkpoint——它要么执行了，要么没执行，trace 里看得到。

**2. 维度覆盖强制**

issue #69 事后分析发现：Phase 3 的全部验收标准属于功能维度（代码写对了），但 7 个 bug 中 6 个属于环境、集成、假设维度。单维度覆盖等于无覆盖。

plan 要求每个 issue 的 checkpoint 覆盖所有相关维度（function / environment / integration / assumption）。review 在评估时检查每个维度是否有至少一个 PASS。整个维度为空意味着这个 Phase 在该维度上完全未验证。

**3. Spike 前置于实现**

如果一个 Phase 的架构假设依赖第三方组件的未文档化行为（如"Debian Chromium 的 CDP 实现兼容 Patchright"），这个假设必须在实现之前被验证。

plan 在任务分解时扫描风险信号，为高风险假设创建 spike issue。spike 的验收标准不是"代码完成"而是"假设被证实或证伪"。spike 失败触发设计调整，而非在错误假设上堆叠多个 Phase 的代码。

**4. 推迟验证不可遗忘**

如果某个 checkpoint 在当前环境无法执行（如本机没有 Docker daemon），plan 将其作为 inherited verification obligation 分配到下游 issue。obligation 不可二次推迟——到达目标 issue 时必须执行。

### 无状态运行

loop.ts 是纯状态机：创建 `.dev-loop` → 交替 spawn agent → 检查 `.dev-loop` 是否存在。

所有业务状态收敛在 GitHub issue 中：

| 状态 | 存储位置 |
|---|---|
| 任务内容和 checkpoint 定义 | issue body |
| 任务进度 | issue labels (in-progress / review / blocked) |
| 迭代反馈 | issue comments（review agent 写，iteration agent 读） |
| 当前迭代的执行证据 | `.dev-trace.txt`（每轮覆写，不持久） |

每次 iteration agent 和 review agent 被 spawn 时，它们从零开始，读 issue 获取全部上下文。agent 之间没有共享内存，唯一通信渠道是 issue comments。

---

## 用法

### 阶段一：规划（跑一次）

```
/dev:plan
```

读取设计文档，产出：
- **GitHub Issues**：带 checkpoint 表格、维度标注、spike issue、inherited obligations 的任务
- **CLAUDE.md**（每个 repo 一份）：每次迭代前 agent 读的上下文

### 阶段二：循环

```
/dev:loop        # 无限循环
/dev:loop 10     # 最多 10 轮
```

循环交替运行 iteration agent 和 review agent。删除 `.dev-loop` 可随时停止。

---

## 文件

| 文件 | 说明 |
|---|---|
| `src/loop.ts` | 循环状态机。创建 `.dev-loop`，交替 spawn 两个 agent，捕获输出写 trace |
| `.claude/commands/dev:plan.md` | plan skill。信号结构定义：checkpoint 表格、维度、spike、obligations |
| `.claude/commands/dev:loop.md` | loop skill。启动迭代循环 |
| `dev-iter.md` | iteration agent prompt。信号产生：实现 + 执行 checkpoint + 报告结果 |
| `dev-review.md` | review agent prompt。信号消费：审计 checkpoint、维度覆盖、obligations |

使用前需将 skills 拷贝到全局：
```bash
cp .claude/commands/dev:*.md ~/.claude/commands/
```

## References

1. ReVeal: Self-Evolving Code Agents via Iterative Generation-Verification. arxiv 2506.11442, 2025.
2. VeRPO: Verifiable Dense Reward Policy Optimization for Code Generation. arxiv 2601.03525, 2025.
3. DynaFix: Iterative Automated Program Repair Driven by Execution-Level Dynamic Information. arxiv 2512.24635, 2025.
4. EDDOps: Evaluation-Driven Development and Operations of LLM Agents. arxiv 2411.13768, 2024.
5. Beyond Task Completion: An Assessment Framework for Evaluating Agentic AI Systems. arxiv 2512.12791, 2024.
6. Exploring Autonomous Agents: A Closer Look at Why They Fail When Completing Tasks. arxiv 2508.13143, 2025.
7. VMAO: Verified Multi-Agent Orchestration. arxiv 2603.11445, 2025.
