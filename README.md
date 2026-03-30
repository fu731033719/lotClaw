# lotClaw

lotClaw 是一个面向工具调用、任务规划与执行编排的 Agent Runtime 骨架项目。

## 当前状态

当前仓库已完成 Monorepo 基础结构初始化，包含：

- `apps/api` API 服务骨架
- `apps/web` Web 控制台骨架
- `apps/cli` CLI 入口骨架
- `apps/worker` 后台任务执行器骨架
- `packages/agent-core` Agent 执行核心
- `packages/agent-tools` 工具协议与注册中心
- `packages/model-adapters` 模型适配层
- `packages/shared-*` 共享类型、配置和工具函数

## 快速开始

```bash
npm install
npm run dev
```

## 下一步

- 完成 Tool Framework 第一版
- 接入模型 Provider
- 实现 Agent Loop MVP
- 打通 CLI -> Core -> Tool 调用链路
