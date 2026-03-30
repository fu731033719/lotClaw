import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

export type ToolPermission = "safe" | "guarded" | "dangerous";

export interface ToolContext {
  sessionId?: string;
  taskId?: string;
  workspaceRoot?: string;
  abortSignal?: AbortSignal;
}

export interface ToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  };
  metadata?: {
    durationMs?: number;
    truncated?: boolean;
  };
}

export interface ToolSchema {
  input: string;
  output: string;
}

export interface ValidationResult {
  ok: boolean;
  message?: string;
}

export interface AgentTool<Input = unknown, Output = unknown> {
  name: string;
  description: string;
  version: string;
  permission: ToolPermission;
  schema: ToolSchema;
  validate?(input: Input): ValidationResult;
  execute(input: Input, context: ToolContext): Promise<ToolResult<Output>>;
}

export interface RegisteredTool {
  name: string;
  description: string;
  version: string;
  permission: ToolPermission;
  schema: ToolSchema;
}

export interface ToolCall<Input = unknown> {
  toolName: string;
  input: Input;
}

export interface ToolExecutionResult<Output = unknown> {
  tool: RegisteredTool;
  result: ToolResult<Output>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();

  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  registerMany(tools: AgentTool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  list(): RegisteredTool[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      version: tool.version,
      permission: tool.permission,
      schema: tool.schema
    }));
  }

  async execute<Input, Output>(
    call: ToolCall<Input>,
    context: ToolContext
  ): Promise<ToolExecutionResult<Output>> {
    const tool = this.get(call.toolName);

    if (!tool) {
      return {
        tool: createUnknownTool(call.toolName),
        result: createErrorResult("TOOL_NOT_FOUND", `Tool "${call.toolName}" is not registered.`)
      };
    }

    const validation = tool.validate?.(call.input);
    if (validation && !validation.ok) {
      return {
        tool: toRegisteredTool(tool),
        result: createErrorResult(
          "TOOL_VALIDATION_FAILED",
          validation.message ?? `Tool "${tool.name}" rejected the input.`
        )
      };
    }

    const startedAt = Date.now();
    const result = (await tool.execute(call.input, context)) as ToolResult<Output>;

    return {
      tool: toRegisteredTool(tool),
      result: {
        ...result,
        metadata: {
          ...result.metadata,
          durationMs: result.metadata?.durationMs ?? Date.now() - startedAt
        }
      }
    };
  }
}

export interface ListDirInput {
  path?: string;
}

export interface ListDirOutput {
  path: string;
  entries: Array<{
    name: string;
    type: "file" | "directory" | "other";
  }>;
}

export class ListDirTool implements AgentTool<ListDirInput, ListDirOutput> {
  name = "list_dir";
  description = "List files and directories under a workspace-relative path.";
  version = "1.1.0";
  permission = "safe" as const;
  schema = {
    input: "{ path?: string }",
    output: "{ path: string; entries: Array<{ name: string; type: string }> }"
  };

  validate(input: ListDirInput): ValidationResult {
    if (input.path !== undefined && typeof input.path !== "string") {
      return { ok: false, message: 'Expected "path" to be a string.' };
    }

    return { ok: true };
  }

  async execute(
    input: ListDirInput,
    context: ToolContext
  ): Promise<ToolResult<ListDirOutput>> {
    try {
      const targetPath = resolveWorkspacePath(context, input.path ?? ".");
      const entries = await readdir(targetPath, { withFileTypes: true });

      return {
        ok: true,
        data: {
          path: targetPath,
          entries: entries.map((entry) => ({
            name: entry.name,
            type: entry.isDirectory()
              ? "directory"
              : entry.isFile()
                ? "file"
                : "other"
          }))
        }
      };
    } catch (error) {
      return createErrorResult(
        "LIST_DIR_FAILED",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}

export interface ReadFileInput {
  path: string;
  encoding?: BufferEncoding;
}

export interface ReadFileOutput {
  path: string;
  content: string;
}

export class ReadFileTool implements AgentTool<ReadFileInput, ReadFileOutput> {
  name = "read_file";
  description = "Read a workspace-relative file as text.";
  version = "1.1.0";
  permission = "safe" as const;
  schema = {
    input: "{ path: string; encoding?: BufferEncoding }",
    output: "{ path: string; content: string }"
  };

  validate(input: ReadFileInput): ValidationResult {
    if (!input.path || typeof input.path !== "string") {
      return { ok: false, message: 'Expected "path" to be a non-empty string.' };
    }

    return { ok: true };
  }

  async execute(
    input: ReadFileInput,
    context: ToolContext
  ): Promise<ToolResult<ReadFileOutput>> {
    try {
      const targetPath = resolveWorkspacePath(context, input.path);
      const content = await readFile(targetPath, {
        encoding: input.encoding ?? "utf8",
        signal: context.abortSignal
      });

      return {
        ok: true,
        data: {
          path: targetPath,
          content
        },
        metadata: {
          truncated: false
        }
      };
    } catch (error) {
      return createErrorResult(
        "READ_FILE_FAILED",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}

export interface WriteFileInput {
  path: string;
  content: string;
  createDirectories?: boolean;
}

export interface WriteFileOutput {
  path: string;
  bytesWritten: number;
}

export class WriteFileTool implements AgentTool<WriteFileInput, WriteFileOutput> {
  name = "write_file";
  description = "Write text content to a workspace-relative file.";
  version = "1.1.0";
  permission = "guarded" as const;
  schema = {
    input: "{ path: string; content: string; createDirectories?: boolean }",
    output: "{ path: string; bytesWritten: number }"
  };

  validate(input: WriteFileInput): ValidationResult {
    if (!input.path || typeof input.path !== "string") {
      return { ok: false, message: 'Expected "path" to be a non-empty string.' };
    }

    if (typeof input.content !== "string") {
      return { ok: false, message: 'Expected "content" to be a string.' };
    }

    return { ok: true };
  }

  async execute(
    input: WriteFileInput,
    context: ToolContext
  ): Promise<ToolResult<WriteFileOutput>> {
    try {
      const targetPath = resolveWorkspacePath(context, input.path);

      if (input.createDirectories) {
        await mkdir(dirname(targetPath), { recursive: true });
      }

      await writeFile(targetPath, input.content, {
        encoding: "utf8",
        signal: context.abortSignal
      });

      return {
        ok: true,
        data: {
          path: targetPath,
          bytesWritten: Buffer.byteLength(input.content, "utf8")
        }
      };
    } catch (error) {
      return createErrorResult(
        "WRITE_FILE_FAILED",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}

export interface PatchFileInput {
  path: string;
  find: string;
  replace: string;
}

export interface PatchFileOutput {
  path: string;
  replaced: boolean;
}

export class PatchFileTool implements AgentTool<PatchFileInput, PatchFileOutput> {
  name = "patch_file";
  description = "Replace a text fragment inside a workspace-relative file.";
  version = "1.1.0";
  permission = "guarded" as const;
  schema = {
    input: "{ path: string; find: string; replace: string }",
    output: "{ path: string; replaced: boolean }"
  };

  validate(input: PatchFileInput): ValidationResult {
    if (!input.path || typeof input.path !== "string") {
      return { ok: false, message: 'Expected "path" to be a non-empty string.' };
    }

    if (typeof input.find !== "string" || input.find.length === 0) {
      return { ok: false, message: 'Expected "find" to be a non-empty string.' };
    }

    if (typeof input.replace !== "string") {
      return { ok: false, message: 'Expected "replace" to be a string.' };
    }

    return { ok: true };
  }

  async execute(
    input: PatchFileInput,
    context: ToolContext
  ): Promise<ToolResult<PatchFileOutput>> {
    try {
      const targetPath = resolveWorkspacePath(context, input.path);
      const original = await readFile(targetPath, {
        encoding: "utf8",
        signal: context.abortSignal
      });

      if (!original.includes(input.find)) {
        return createErrorResult(
          "PATCH_TARGET_NOT_FOUND",
          `Could not find the target text in "${input.path}".`
        );
      }

      const nextContent = original.replace(input.find, input.replace);
      await writeFile(targetPath, nextContent, {
        encoding: "utf8",
        signal: context.abortSignal
      });

      return {
        ok: true,
        data: {
          path: targetPath,
          replaced: true
        }
      };
    } catch (error) {
      return createErrorResult(
        "PATCH_FILE_FAILED",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}

export interface FinishInput {
  summary: string;
}

export interface FinishOutput {
  summary: string;
  finished: true;
}

export class FinishTool implements AgentTool<FinishInput, FinishOutput> {
  name = "finish";
  description = "Finalize a task with a structured summary.";
  version = "1.1.0";
  permission = "safe" as const;
  schema = {
    input: "{ summary: string }",
    output: "{ summary: string; finished: true }"
  };

  validate(input: FinishInput): ValidationResult {
    if (!input.summary || typeof input.summary !== "string") {
      return { ok: false, message: 'Expected "summary" to be a non-empty string.' };
    }

    return { ok: true };
  }

  async execute(input: FinishInput): Promise<ToolResult<FinishOutput>> {
    return {
      ok: true,
      data: {
        summary: input.summary,
        finished: true
      }
    };
  }
}

export function createDefaultTools(): AgentTool[] {
  return [
    new ListDirTool(),
    new ReadFileTool(),
    new WriteFileTool(),
    new PatchFileTool(),
    new FinishTool()
  ];
}

function createUnknownTool(name: string): RegisteredTool {
  return {
    name,
    description: "Unknown tool",
    version: "0.0.0",
    permission: "dangerous",
    schema: {
      input: "unknown",
      output: "unknown"
    }
  };
}

function toRegisteredTool(tool: AgentTool): RegisteredTool {
  return {
    name: tool.name,
    description: tool.description,
    version: tool.version,
    permission: tool.permission,
    schema: tool.schema
  };
}

function createErrorResult(
  code: string,
  message: string
): ToolResult<never> {
  return {
    ok: false,
    error: {
      code,
      message
    }
  };
}

function resolveWorkspacePath(context: ToolContext, candidatePath: string): string {
  const workspaceRoot = resolve(context.workspaceRoot ?? process.cwd());
  const targetPath = resolve(workspaceRoot, candidatePath);
  const relativePath = relative(workspaceRoot, targetPath);

  if (relativePath.startsWith("..") || relativePath.includes(":")) {
    throw new Error(`Path "${candidatePath}" resolves outside the workspace root.`);
  }

  return targetPath;
}
