# lotClaw 项目蓝图

## 1. 项目目标

构建一个类似 openClaw 的通用 Agent 工具，具备以下能力：

- 接收自然语言任务
- 基于上下文做规划与执行
- 通过工具调用完成检索、文件操作、命令执行、网页访问等动作
- 支持多轮对话、任务状态管理、执行日志和可观测性
- 允许未来扩展为多 Agent 协作、工作流编排、插件生态

本项目建议先做成“单机可运行、可调试、可扩展”的 Agent Runtime，再逐步补全 UI、多 Agent、权限治理和部署能力。

---

## 2. 技术方向建议

推荐先采用以下技术栈：

- 语言：TypeScript
- 运行时：Node.js 20+
- API 服务：Fastify 或 NestJS
- CLI：Commander
- 前端：Next.js
- 数据库：PostgreSQL
- 缓存 / 队列：Redis
- ORM：Prisma
- LLM 适配：抽象 Provider 层，兼容 OpenAI / Anthropic / 本地模型
- 向量检索：pgvector 或 Qdrant
- 日志：Pino
- 任务队列：BullMQ
- 测试：Vitest + Playwright

如果你更偏 Python，也可以切到 `FastAPI + Celery + SQLAlchemy`，但如果目标是做平台型 Agent 产品，TypeScript 在前后端统一和工具生态上会更顺手。

---

## 3. 推荐项目结构

推荐用 Monorepo，方便后续拆分 Agent Runtime、Web UI、SDK 和插件。

```text
lotClaw/
├─ apps/
│  ├─ api/                       # 对外 API / Webhook / SSE
│  ├─ web/                       # 管理后台 / 会话界面 / 任务面板
│  ├─ worker/                    # 后台任务执行器
│  └─ cli/                       # 本地 CLI Agent 入口
├─ packages/
│  ├─ agent-core/                # Agent 核心：推理、规划、执行循环
│  ├─ agent-memory/              # 记忆、上下文压缩、向量检索
│  ├─ agent-tools/               # 工具定义、注册、调用协议
│  ├─ agent-runtime/             # 会话运行时、任务状态机、调度
│  ├─ agent-workflows/           # 工作流模板、任务编排
│  ├─ model-adapters/            # 各类 LLM Provider 适配层
│  ├─ prompt-kit/                # System prompt、模板、输出约束
│  ├─ shared-types/              # 全局类型、DTO、事件定义
│  ├─ shared-config/             # 配置加载、环境变量、特性开关
│  ├─ shared-utils/              # 通用工具函数
│  └─ ui-components/             # 前端复用组件
├─ plugins/
│  ├─ tool-filesystem/           # 文件系统工具插件
│  ├─ tool-shell/                # 命令执行工具插件
│  ├─ tool-browser/              # 浏览器自动化插件
│  ├─ tool-http/                 # HTTP 请求工具插件
│  ├─ tool-rag/                  # 知识库 / 检索工具插件
│  ├─ tool-db/                   # 数据库查询插件
│  └─ tool-codebase/             # 代码库分析插件
├─ infra/
│  ├─ docker/
│  ├─ k8s/
│  └─ terraform/
├─ docs/
│  ├─ architecture/
│  ├─ api/
│  ├─ prompts/
│  ├─ runbooks/
│  └─ roadmap/
├─ scripts/
│  ├─ dev/
│  ├─ seed/
│  └─ release/
├─ tests/
│  ├─ e2e/
│  ├─ integration/
│  └─ fixtures/
├─ .env.example
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
└─ README.md
```

---

## 4. 核心模块设计

### 4.1 Agent Core

负责 Agent 的主循环：

1. 接收用户输入
2. 读取会话上下文和记忆
3. 生成计划
4. 判断是否调用工具
5. 执行工具
6. 汇总工具结果
7. 继续思考或输出最终答案
8. 记录事件与状态

核心类建议：

- `AgentSession`
- `AgentExecutor`
- `Planner`
- `Reasoner`
- `ToolRouter`
- `ObservationReducer`
- `FinalResponder`

### 4.2 Runtime

负责“如何跑起来”：

- 会话生命周期管理
- 长任务执行
- 中断 / 恢复 / 超时
- 重试策略
- 并发控制
- 任务队列调度
- 事件广播

关键能力：

- 同步请求模式
- 异步任务模式
- SSE / WebSocket 实时事件流
- 可恢复任务执行快照

### 4.3 Tool Framework

这是最关键的底座。建议所有工具都走统一协议。

工具统一接口建议：

```ts
interface AgentTool<Input = unknown, Output = unknown> {
  name: string;
  description: string;
  version: string;
  schema: {
    input: unknown;
    output?: unknown;
  };
  permissions?: string[];
  timeoutMs?: number;
  canRun(context: ToolContext): Promise<boolean>;
  execute(input: Input, context: ToolContext): Promise<ToolResult<Output>>;
}
```

工具执行结果建议标准化：

```ts
interface ToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  };
  metadata?: {
    durationMs?: number;
    tokensUsed?: number;
    truncated?: boolean;
  };
}
```

工具框架应具备：

- 工具注册与发现
- 参数校验
- 权限校验
- 超时控制
- 幂等处理
- 调用日志
- 输出截断与摘要
- 敏感字段脱敏

### 4.4 Memory

建议拆成三层：

- 短期记忆：当前会话消息、工具结果、系统指令
- 中期记忆：任务摘要、用户偏好、已知约束
- 长期记忆：知识文档、历史任务、RAG 检索片段

关键能力：

- 上下文窗口裁剪
- 历史摘要
- 检索增强
- 用户画像
- 任务恢复

### 4.5 Model Adapter

不要把代码直接绑死在某一家模型厂商上。

统一接口建议：

- `generateText`
- `streamText`
- `toolCall`
- `embed`
- `moderate`

支持配置：

- 模型选择
- 温度
- 最大 token
- 超时
- 重试
- fallback 模型链路

### 4.6 Workflow Engine

给后期扩展预留：

- 单 Agent 串行执行
- 多步骤工作流
- 人工审批节点
- 多 Agent 分工协作
- 定时任务 / 触发器

---

## 5. 首批工具框架建议

第一版不要贪多，优先做“高频 + 可控”的工具。

### P0 必做工具

- `read_file`
  - 读取指定文件内容
- `write_file`
  - 写入或覆盖文件
- `patch_file`
  - 局部修改文件
- `list_dir`
  - 浏览目录结构
- `search_code`
  - 文本 / 文件搜索
- `run_command`
  - 受限命令执行
- `fetch_url`
  - 抓取网页或 API 内容
- `ask_user`
  - 在缺少信息时向用户追问
- `finish`
  - 明确结束执行并返回结果

### P1 增强工具

- `browser_open`
- `browser_click`
- `browser_extract`
- `knowledge_search`
- `sql_query`
- `git_status`
- `git_diff`
- `create_branch`
- `run_test`
- `lint_project`

### P2 平台化工具

- `trigger_workflow`
- `handoff_agent`
- `schedule_task`
- `send_notification`
- `upload_artifact`
- `read_observability_metrics`

---

## 6. 执行链路设计

建议统一成事件驱动的 Agent Loop。

### 6.1 单轮执行流程

```text
User Request
  -> Context Builder
  -> Planner
  -> LLM Decision
  -> Tool Call or Final Answer
  -> Observation Normalizer
  -> Next Step Decision
  -> Final Output
```

### 6.2 事件模型

每一步都发事件，便于 UI 展示和调试：

- `session.created`
- `message.received`
- `context.compiled`
- `plan.generated`
- `tool.called`
- `tool.completed`
- `tool.failed`
- `model.responded`
- `task.completed`
- `task.failed`

### 6.3 状态机

任务状态建议：

- `pending`
- `running`
- `waiting_for_tool`
- `waiting_for_user`
- `retrying`
- `completed`
- `failed`
- `cancelled`

---

## 7. 权限与安全设计

类 openClaw 的 Agent 工具，风险主要集中在“工具执行权限”。

必须从第一版就做好：

- 工具级权限白名单
- 命令执行沙箱
- 路径访问限制
- 网络域名白名单
- API Key 隔离
- 审计日志
- 人工确认机制

建议引入执行等级：

- `safe`
  - 只读操作，可自动执行
- `guarded`
  - 可能修改状态，需要策略判定
- `dangerous`
  - 高风险操作，必须人工确认

例如：

- 读文件：`safe`
- 写文件：`guarded`
- 执行 shell：`guarded` 或 `dangerous`
- 删除资源：`dangerous`

---

## 8. 可观测性设计

如果没有可观测性，Agent 很快就会不可维护。

至少需要：

- 每轮 prompt / completion 日志
- 工具调用耗时
- token 使用统计
- 失败原因分类
- 用户任务成功率
- 平均完成时长
- 中断点记录

建议追踪维度：

- `traceId`
- `sessionId`
- `taskId`
- `toolCallId`
- `userId`
- `model`

---

## 9. API 与交互层建议

### 9.1 API 层

建议先做这些接口：

- `POST /sessions`
- `POST /sessions/:id/messages`
- `GET /sessions/:id`
- `GET /sessions/:id/events`
- `POST /tasks/:id/cancel`
- `POST /tasks/:id/retry`
- `GET /tools`
- `GET /health`

### 9.2 Web UI

第一版页面建议：

- 会话页
  - 对话、执行轨迹、工具调用明细
- 任务页
  - 状态、耗时、重试、错误信息
- 工具页
  - 工具列表、权限、可用性
- 配置页
  - 模型、密钥、运行策略

### 9.3 CLI

CLI 非常值得优先做，因为调试效率高。

建议命令：

```bash
lotclaw chat
lotclaw run "帮我分析这个仓库"
lotclaw tools:list
lotclaw session:inspect <id>
lotclaw replay <taskId>
```

---

## 10. 迭代计划

### 阶段 0：架构验证（1 周）

目标：

- 跑通最小 Agent 闭环
- 证明“模型 + 工具 + 状态机”可用

交付：

- Monorepo 初始化
- `agent-core`、`agent-tools`、`model-adapters` 初版
- CLI 入口
- 3 个基础工具：`read_file`、`list_dir`、`finish`
- 单模型接入
- 基础日志

验收标准：

- 可以通过 CLI 发任务
- Agent 能做 1 到 2 次工具调用后给出结果

### 阶段 1：单 Agent MVP（2 周）

目标：

- 形成可对外演示的最小产品

交付：

- API 服务
- 会话持久化
- 工具注册中心
- `search_code`、`write_file`、`run_command`、`fetch_url`
- SSE 事件流
- 简单 Web 会话界面
- 手动确认高风险工具

验收标准：

- 支持多轮会话
- 支持查看工具调用过程
- 支持失败重试

### 阶段 2：工程化增强（2 到 3 周）

目标：

- 提升稳定性、调试性和可维护性

交付：

- PostgreSQL + Prisma
- Redis + BullMQ
- Prompt 模板管理
- Memory 摘要机制
- 结构化日志
- 指标埋点
- 单元测试与集成测试
- 权限策略模块

验收标准：

- 任务可恢复
- 支持异步长任务
- 有明确错误分类与追踪

### 阶段 3：RAG 与知识能力（2 周）

目标：

- 让 Agent 不只会调用工具，还会用知识

交付：

- 文档导入
- 分块、Embedding、向量检索
- `knowledge_search`
- 会话上下文摘要 + 检索拼装

验收标准：

- Agent 能基于知识库完成问答和任务辅助

### 阶段 4：Browser 与代码代理能力（2 到 3 周）

目标：

- 让 Agent 具备更接近 openClaw 的真实执行力

交付：

- 浏览器工具集
- Git 工具集
- 测试 / lint 工具
- Patch 模式文件修改
- 代码仓库分析工作流

验收标准：

- Agent 能对项目执行“读代码 -> 改代码 -> 跑测试 -> 汇报结果”

### 阶段 5：多 Agent 与工作流编排（3 周+）

目标：

- 从单 Agent 升级到平台能力

交付：

- Agent 角色定义
- 子任务拆分
- 多 Agent 协同协议
- 工作流编排器
- 人工审批节点

验收标准：

- 一个复杂任务可被拆成多个子任务并汇总输出

---

## 11. 推荐开发顺序

如果我们要实际开工，建议按这个顺序推进：

1. 初始化 Monorepo 与基础工程规范
2. 搭建 `agent-tools` 统一工具协议
3. 接入一个模型 Provider
4. 做 CLI 闭环
5. 加会话状态机与日志
6. 补 API + SSE
7. 补 Web 调试界面
8. 补 Memory / RAG
9. 补 Browser / Git / 测试工具
10. 再做多 Agent

原因很简单：

- 先让系统“能跑”
- 再让系统“跑得稳”
- 最后再让系统“跑得强”

---

## 12. MVP 范围控制建议

第一版一定要控制范围，避免一开始做成“大而全平台”。

MVP 只保留：

- 单 Agent
- 单模型 Provider
- CLI + 简单 Web
- 5 到 8 个基础工具
- 会话持久化
- 手动审批
- 基础日志

第一版先不要重投入：

- 多 Agent
- 复杂工作流 DSL
- 插件市场
- 多租户权限系统
- 完整 SaaS 化后台

---

## 13. 下一步建议

建议马上进入以下三个动作：

1. 先确定技术栈
   - TypeScript Monorepo 还是 Python Monorepo
2. 先定义最小工具协议
   - Tool Interface、Tool Result、Tool Context
3. 先初始化骨架仓库
   - `apps/api`、`apps/web`、`apps/cli`
   - `packages/agent-core`
   - `packages/agent-tools`
   - `packages/model-adapters`

如果你愿意，我下一步可以直接继续帮你做：

- 一版可落地的 Monorepo 初始化结构
- 核心 TypeScript 类型定义
- Tool Framework 第一版代码骨架
- Agent Loop MVP 伪代码与接口设计
```
