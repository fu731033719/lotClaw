# Architecture Overview

当前仓库分为四层：

- `apps/*` 对外运行入口
- `packages/*` 领域能力与共享模块
- `docs/*` 架构与方案文档
- `tests/*` 测试与夹具

首个开发目标是打通 `apps/cli -> packages/agent-core -> packages/agent-tools -> packages/model-adapters`。

