# Agent Loop Validation Example

## Goal

Use a concrete multi-step task to verify that the Agent Loop can:

- inspect the workspace first
- use the observation from that tool call
- choose a second tool call dynamically
- stop with a final answer

## Command

Run this from the repository root:

```powershell
node apps/cli/dist/apps/cli/src/index.js "validate loop by inspect then read readme"
```

## Expected behavior

The model-backed planner should classify the task as a multi-step `analyze` intent.

The loop should then:

1. call `list_dir`
2. observe that `README.md` exists
3. call `read_file`
4. finish with a success message

## What this proves

This is a stronger validation than a one-step demo because the second tool call is chosen only after the first observation is available.

That means the runtime is no longer just replaying a fixed plan. It is already capable of a minimal observation-driven ReAct loop.
