import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ToolRegistry, WriteFileTool } from "./index.js";

test("write_file creates files inside the workspace", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "lotclaw-tools-"));
  const registry = new ToolRegistry();
  registry.register(new WriteFileTool());

  const execution = await registry.execute(
    {
      toolName: "write_file",
      input: {
        path: "nested/output.txt",
        content: "hello",
        createDirectories: true
      }
    },
    { workspaceRoot }
  );

  assert.equal(execution.result.ok, true);
  const contents = await readFile(join(workspaceRoot, "nested/output.txt"), "utf8");
  assert.equal(contents, "hello");

  await rm(workspaceRoot, { recursive: true, force: true });
});

test("write_file rejects paths outside the workspace", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "lotclaw-tools-"));
  const registry = new ToolRegistry();
  registry.register(new WriteFileTool());

  const execution = await registry.execute(
    {
      toolName: "write_file",
      input: {
        path: "../escape.txt",
        content: "bad"
      }
    },
    { workspaceRoot }
  );

  assert.equal(execution.result.ok, false);
  assert.equal(execution.result.error?.code, "WRITE_FILE_FAILED");

  await rm(workspaceRoot, { recursive: true, force: true });
});
