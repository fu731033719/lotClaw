# Provider Local Chat Test

## Build

```powershell
npm run build
```

## OpenAI

```powershell
$env:MODEL_PROVIDER='openai'
$env:MODEL_NAME='gpt-5.4'
$env:OPENAI_API_KEY='your_api_key'
node apps/cli/dist/apps/cli/src/index.js chat "你好，请用一句话介绍你自己"
```

## MiniMax

```powershell
$env:MODEL_PROVIDER='minimax'
$env:MINIMAX_MODEL='MiniMax-M2.5'
$env:MINIMAX_API_KEY='your_api_key'
$env:MINIMAX_BASE_URL='https://api.minimax.io/v1'
node apps/cli/dist/apps/cli/src/index.js chat "你好，请用一句话介绍你自己"
```

## Qwen

```powershell
$env:MODEL_PROVIDER='qwen'
$env:QWEN_MODEL='qwen-plus'
$env:QWEN_API_KEY='your_api_key'
$env:QWEN_BASE_URL='https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1'
node apps/cli/dist/apps/cli/src/index.js chat "你好，请用一句话介绍你自己"
```

## Agent loop verification after provider setup

```powershell
node apps/cli/dist/apps/cli/src/index.js "validate loop by inspect then read readme"
```

## Expected order of validation

1. `chat` succeeds with the selected provider.
2. the CLI prints `Model provider: <provider>`.
3. the agent loop command succeeds afterwards.
