# lotClaw

lotClaw is a TypeScript monorepo for building an agent runtime with tool calling, model adapters, and an observation-driven execution loop.

## Current Scope

The repository currently includes:

- CLI entrypoint
- agent core with plan mode and loop mode
- tool framework with guarded filesystem tools
- model adapters for `stub`, `openai`, `minimax`, and `qwen`
- local tests for tools, adapters, and loop behavior

## Repository Layout

```text
apps/
  api/
  cli/
  web/
  worker/
packages/
  agent-core/
  agent-tools/
  model-adapters/
  shared-config/
  shared-types/
  shared-utils/
docs/
  architecture/
```

## Install

```bash
npm install
```

## Verification

```bash
npm run typecheck
npm run build
npm run test
```

## CLI

### Provider doctor

Print current provider configuration without exposing the full key:

```powershell
node apps/cli/dist/apps/cli/src/index.js doctor
```

### Local chat smoke test

Use the currently selected provider for a single-turn chat:

```powershell
node apps/cli/dist/apps/cli/src/index.js chat "hello"
```

### Agent loop validation

Run the observation-driven multi-step example:

```powershell
node apps/cli/dist/apps/cli/src/index.js "validate loop by inspect then read readme"
```

Set `LOTCLAW_TRACE=1` to print raw runtime events:

```powershell
$env:LOTCLAW_TRACE='1'
node apps/cli/dist/apps/cli/src/index.js "validate loop by inspect then read readme"
```

## Provider Setup

### OpenAI

```powershell
$env:MODEL_PROVIDER='openai'
$env:MODEL_NAME='gpt-5.4'
$env:OPENAI_API_KEY='your_api_key'
node apps/cli/dist/apps/cli/src/index.js chat "你好，请用一句话介绍你自己"
```

### MiniMax

```powershell
$env:MODEL_PROVIDER='minimax'
$env:MINIMAX_MODEL='MiniMax-M2.5'
$env:MINIMAX_API_KEY='your_api_key'
$env:MINIMAX_BASE_URL='https://api.minimax.io/v1'
node apps/cli/dist/apps/cli/src/index.js chat "你好，请用一句话介绍你自己"
```

### Qwen

```powershell
$env:MODEL_PROVIDER='qwen'
$env:QWEN_MODEL='qwen-plus'
$env:QWEN_API_KEY='your_api_key'
$env:QWEN_BASE_URL='https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
node apps/cli/dist/apps/cli/src/index.js chat "你好，请用一句话介绍你自己"
```

## Notes

- `stub` remains the default provider for local development.
- `doctor` trims environment values before reporting status.
- `chat` is the fastest way to verify provider connectivity before testing the full loop.
- `validate loop by inspect then read readme` is the current MVP loop proof case.
