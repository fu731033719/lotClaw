import assert from "node:assert/strict";
import test from "node:test";

import {
  MiniMaxModelAdapter,
  OpenAIModelAdapter,
  QwenModelAdapter,
  StubModelAdapter,
  createModelAdapter
} from "./index.js";

test("stub model returns analyze intent for loop validation goal", async () => {
  const model = new StubModelAdapter();
  const decision = await model.decideTaskIntent("validate loop by inspect then read readme");

  assert.equal(decision.intent.type, "analyze");
  assert.equal(decision.intent.target?.path, ".");
  assert.equal(decision.intent.inputs.followUpPath, "README.md");
});

test("stub model selects read_file after list_dir observation confirms README", async () => {
  const model = new StubModelAdapter();
  const decision = await model.decideTaskIntent("validate loop by inspect then read readme");

  const nextAction = await model.decideNextAction({
    goal: "validate loop by inspect then read readme",
    intent: decision.intent,
    availableTools: [],
    observations: [
      {
        toolName: "list_dir",
        ok: true,
        summary: "list_dir completed successfully.",
        data: {
          path: ".",
          entries: [
            { name: "README.md", type: "file" },
            { name: "packages", type: "directory" }
          ]
        }
      }
    ]
  });

  assert.equal(nextAction.type, "tool_call");
  if (nextAction.type === "tool_call") {
    assert.equal(nextAction.toolName, "read_file");
    assert.equal(nextAction.input.path, "README.md");
  }
});

test("factory creates openai provider when configured", async () => {
  const adapter = createModelAdapter({
    provider: "openai",
    apiKey: "test-key",
    model: "gpt-5.4"
  });

  assert.ok(adapter instanceof OpenAIModelAdapter);
  assert.equal(adapter.name, "openai");
});

test("factory rejects openai provider without api key", async () => {
  assert.throws(() => createModelAdapter({ provider: "openai", model: "gpt-5.4" }), {
    message: 'OPENAI_API_KEY is required when MODEL_PROVIDER is "openai".'
  });
});

test("factory creates minimax provider when configured", async () => {
  const adapter = createModelAdapter({
    provider: "minimax",
    apiKey: "test-key",
    model: "MiniMax-M2.5"
  });

  assert.ok(adapter instanceof MiniMaxModelAdapter);
  assert.equal(adapter.name, "minimax");
});

test("factory creates qwen provider when configured", async () => {
  const adapter = createModelAdapter({
    provider: "qwen",
    apiKey: "test-key",
    model: "qwen-plus"
  });

  assert.ok(adapter instanceof QwenModelAdapter);
  assert.equal(adapter.name, "qwen");
});
