import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createDefaultTools, ToolRegistry } from "@lotclaw/agent-tools";
import { StubModelAdapter } from "@lotclaw/model-adapters";

import { AgentExecutor } from "./index.js";

test("executeLoop performs observation-driven multi-step flow", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "lotclaw-loop-"));
  await writeFile(
    join(workspaceRoot, "README.md"),
    "Loop validation README",
    "utf8"
  );

  const registry = new ToolRegistry();
  registry.registerMany(createDefaultTools());

  const executor = new AgentExecutor(registry);
  const model = new StubModelAdapter();
  const decision = await model.decideTaskIntent("validate loop by inspect then read readme");

  const output = await executor.executeLoop({
    goal: "validate loop by inspect then read readme",
    intent: decision.intent,
    model,
    context: {
      workspaceRoot
    }
  });

  assert.equal(output.status, "completed");
  assert.equal(output.steps.length, 2);
  assert.equal(output.steps[0]?.tool.name, "list_dir");
  assert.equal(output.steps[1]?.tool.name, "read_file");
  assert.equal(output.finalOutput, "Workspace inspected and README.md read successfully.");

  await rm(workspaceRoot, { recursive: true, force: true });
});
