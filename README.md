# coder-loop

无人值守开发循环。用两个 AI agent 交替运行：一个干活，一个审计。

## 架构

```
while .dev-loop 存在:
    claude -p dev-loop.md      # iteration agent：选 issue → 实现 → 提 PR
    claude -p dev-review.md    # review agent：审计过程 + 结果 → 决定继续/停止
```

- **iteration agent** 读 issue（含 comments）、读设计文档、读 CLAUDE.md，实现一个任务
- **review agent** 读 iteration agent 的完整执行 trace（`.dev-trace.txt`），审计过程和结果
- review agent 是唯一有权决定循环是否继续的角色。删除 `.dev-loop` 文件 = 停止循环
- iteration agent 没有任何循环控制权。它只干活、汇报

## 文件

| 文件 | 角色 |
|---|---|
| `src/loop.ts` | 循环程序。创建 `.dev-loop`，交替 spawn 两个 agent，检查文件是否还在 |
| `dev-plan.md` | Skill：把已有的设计文档适配成 loop 能跑的格式（issues + CLAUDE.md） |
| `dev-loop.md` | Skill：iteration agent 的 prompt。定义预检、选任务、实现、验证、提 PR 的流程 |
| `dev-review.md` | Skill：review agent 的 prompt。审计 trace、设计一致性、代码质量，写指导到 issue comment |

## 用法

### 1. 准备（用 /dev:plan skill）

在 Claude Code 会话中运行 `/dev:plan`，或者用 `claude -p` 执行 `dev-plan.md`：

- 读设计文档 → 创建 GitHub Issues（含验收标准、依赖关系、repo 上下文）
- 为每个要修改的 repo 生成 CLAUDE.md（项目规范，不含工作流）
- 没有设计文档时引导用户准备

### 2. 运行

```bash
bun run loop        # 无限循环，直到 review agent 停止或手动删除 .dev-loop
bun run loop 10     # 最多 10 次迭代
```

### 3. 控制

```bash
rm .dev-loop        # 随时停止（当前迭代完成后生效）
```

## 循环流转

```
iteration agent 干活
    ↓
trace 写入 .dev-trace.txt（覆盖）
    ↓
review agent 读 trace + PR + issue
    ↓
├── 质量可接受 → merge PR，继续下一轮
├── 有问题但可修 → 在 issue comment 写指导，继续（retry）
└── 完全无法继续 → 删 .dev-loop，循环结束
```

## review agent 的审计范围

1. **过程审计**：agent 声称做了什么 vs trace 里实际做了什么
2. **设计一致性**：PR 是否符合设计文档
3. **代码质量**：验收标准是否真正满足

review 的指导写在 issue comment 里。iteration agent 读 issue 时必须连带 comments 一起读，这样就能看到 review 的反馈。

## 设计原则

- 程序只管循环控制（文件存不存在）。不知道 GitHub、git、设计文档的存在
- 所有对外部资源的检查、修复、操作都在 skill（.md）里定义，由 agent 执行
- review agent 尽可能让循环跑下去。只有彻底无法继续才停止
- plan 不做设计。它只把已有设计适配成 loop 能消费的格式
