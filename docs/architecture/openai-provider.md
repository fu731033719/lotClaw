# OpenAI Provider

## Required environment

Set these variables before running the CLI with the real provider:

```powershell
$env:MODEL_PROVIDER='openai'
$env:MODEL_NAME='gpt-5.4'
$env:OPENAI_API_KEY='your_api_key'
```

Optional:

```powershell
$env:OPENAI_BASE_URL='https://api.openai.com/v1'
```

## Example

```powershell
node apps/cli/dist/apps/cli/src/index.js "validate loop by inspect then read readme"
```

## Expected behavior

- the CLI should report `Model provider: openai`
- the planner should return a structured task intent
- the loop should choose the next tool call from observations

## Notes

- if `MODEL_PROVIDER=openai` and `OPENAI_API_KEY` is missing, startup should fail fast
- the implementation uses the OpenAI Responses API and structured JSON outputs for planner decisions
