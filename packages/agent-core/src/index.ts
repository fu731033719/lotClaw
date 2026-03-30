import {
  type ToolCall,
  type ToolContext,
  type ToolExecutionResult,
  type ToolRegistry
} from "@lotclaw/agent-tools";
import type {
  ActionObservation,
  ModelAdapter,
  NextAction,
  PlanningDecision,
  TaskIntentSchema,
  ToolDescriptor
} from "@lotclaw/model-adapters";
import type { RuntimeEvent, TaskStatus } from "@lotclaw/shared-types";
import { createId, nowIso } from "@lotclaw/shared-utils";

export interface ExecutionStep<Input = unknown> {
  id: string;
  toolCall: ToolCall<Input>;
}

export interface ExecutionPlan {
  id: string;
  goal: string;
  steps: ExecutionStep[];
  decision?: PlanningDecision;
}

export interface PlannerInput {
  goal: string;
}

export interface AgentExecutionInput {
  goal: string;
  plan: ExecutionPlan;
  context?: ToolContext;
}

export interface LoopExecutionInput {
  goal: string;
  intent: TaskIntentSchema;
  model: ModelAdapter;
  context?: ToolContext;
  maxIterations?: number;
}

export interface AgentExecutionOutput {
  status: TaskStatus;
  goal: string;
  steps: Array<ToolExecutionResult>;
  finalOutput?: string;
  events: RuntimeEvent[];
}

export class AgentExecutor {
  private status: TaskStatus = "pending";

  constructor(private readonly tools: ToolRegistry) {}

  getStatus(): TaskStatus {
    return this.status;
  }

  getToolCount(): number {
    return this.tools.list().length;
  }

  async execute(input: AgentExecutionInput): Promise<AgentExecutionOutput> {
    const events: RuntimeEvent[] = [];
    const steps: Array<ToolExecutionResult> = [];

    this.status = "running";
    events.push(createEvent("task.started", { goal: input.goal, planId: input.plan.id }));

    for (const step of input.plan.steps) {
      this.status = "waiting_for_tool";
      events.push(createEvent("tool.called", { stepId: step.id, toolName: step.toolCall.toolName }));

      const execution = await this.tools.execute(step.toolCall, input.context ?? {});
      steps.push(execution);

      if (execution.result.ok) {
        events.push(
          createEvent("tool.completed", {
            stepId: step.id,
            toolName: step.toolCall.toolName
          })
        );
      } else {
        this.status = "failed";
        events.push(
          createEvent("tool.failed", {
            stepId: step.id,
            toolName: step.toolCall.toolName,
            error: execution.result.error
          })
        );

        return {
          status: this.status,
          goal: input.goal,
          steps,
          finalOutput: execution.result.error?.message,
          events
        };
      }
    }

    this.status = "completed";
    const finalOutput = extractFinalOutput(steps);
    events.push(createEvent("task.completed", { goal: input.goal, finalOutput }));

    return {
      status: this.status,
      goal: input.goal,
      steps,
      finalOutput,
      events
    };
  }

  async executeLoop(input: LoopExecutionInput): Promise<AgentExecutionOutput> {
    const events: RuntimeEvent[] = [];
    const steps: Array<ToolExecutionResult> = [];
    const observations: ActionObservation[] = [];
    const maxIterations = input.maxIterations ?? 6;

    this.status = "running";
    events.push(createEvent("task.started", { goal: input.goal, mode: "loop" }));
    events.push(
      createEvent("intent.selected", {
        goal: input.goal,
        intentType: input.intent.type,
        summary: input.intent.summary
      })
    );

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const decision = await input.model.decideNextAction({
        goal: input.goal,
        intent: input.intent,
        availableTools: toToolDescriptors(this.tools),
        observations
      });

      events.push(
        createEvent("model.decided", {
          iteration,
          actionType: decision.type,
          thought: decision.thought,
          toolName: decision.type === "tool_call" ? decision.toolName : undefined
        })
      );

      if (decision.type === "finish") {
        this.status = "completed";
        events.push(
          createEvent("task.completed", {
            goal: input.goal,
            finalOutput: decision.finalOutput,
            iteration
          })
        );

        return {
          status: this.status,
          goal: input.goal,
          steps,
          finalOutput: decision.finalOutput,
          events
        };
      }

      this.status = "waiting_for_tool";
      events.push(
        createEvent("tool.called", {
          iteration,
          toolName: decision.toolName
        })
      );

      const execution = await this.tools.execute(decision, input.context ?? {});
      steps.push(execution);
      observations.push(toObservation(execution));

      if (execution.result.ok) {
        events.push(
          createEvent("tool.completed", {
            iteration,
            toolName: decision.toolName
          })
        );
      } else {
        this.status = "failed";
        events.push(
          createEvent("tool.failed", {
            iteration,
            toolName: decision.toolName,
            error: execution.result.error
          })
        );

        return {
          status: this.status,
          goal: input.goal,
          steps,
          finalOutput: execution.result.error?.message,
          events
        };
      }
    }

    this.status = "failed";
    events.push(createEvent("task.failed", { goal: input.goal, reason: "MAX_ITERATIONS_REACHED" }));

    return {
      status: this.status,
      goal: input.goal,
      steps,
      finalOutput: "Agent loop stopped after reaching the maximum iteration limit.",
      events
    };
  }
}

export class RuleBasedPlanner {
  createPlan(input: PlannerInput): ExecutionPlan {
    const normalized = input.goal.trim().toLowerCase();

    if (matchesAny(normalized, ["create", "write", "make", "new"])) {
      return createExecutionPlan(input.goal, [
        {
          toolName: "write_file",
          input: {
            path: "scratch/agent-output.txt",
            content: `Generated by lotClaw for goal: ${input.goal}\n`,
            createDirectories: true
          }
        },
        {
          toolName: "finish",
          input: {
            summary: 'Created "scratch/agent-output.txt".'
          }
        }
      ]);
    }

    if (matchesAny(normalized, ["patch", "replace", "update"])) {
      return createExecutionPlan(input.goal, [
        {
          toolName: "patch_file",
          input: {
            path: "README.md",
            find: "lotClaw 是一个面向工具调用、任务规划与执行编排的 Agent Runtime 骨架项目。",
            replace: "lotClaw 是一个面向工具调用、任务规划、文件修改与执行编排的 Agent Runtime 骨架项目。"
          }
        },
        {
          toolName: "finish",
          input: {
            summary: 'Patched "README.md" with the updated project description.'
          }
        }
      ]);
    }

    if (matchesAny(normalized, ["read", "show", "open", "readme"])) {
      return createExecutionPlan(input.goal, [
        {
          toolName: "read_file",
          input: {
            path: "README.md"
          }
        },
        {
          toolName: "finish",
          input: {
            summary: 'Read "README.md".'
          }
        }
      ]);
    }

    return createExecutionPlan(input.goal, [
      {
        toolName: "list_dir",
        input: {
          path: "."
        }
      },
      {
        toolName: "finish",
        input: {
          summary: "Workspace inspection completed."
        }
      }
    ]);
  }
}

export class ModelBackedPlanner {
  constructor(private readonly model: ModelAdapter) {}

  async createPlan(input: PlannerInput): Promise<ExecutionPlan> {
    const decision = await this.model.decideTaskIntent(input.goal);
    return createPlanFromIntent(input.goal, decision);
  }

  async createDecision(input: PlannerInput): Promise<PlanningDecision> {
    return this.model.decideTaskIntent(input.goal);
  }
}

export function createRuntimeBanner(target: string): string {
  return `lotClaw runtime booting for ${target}`;
}

export function createExecutionPlan(
  goal: string,
  calls: Array<ToolCall>,
  decision?: PlanningDecision
): ExecutionPlan {
  return {
    id: createId("plan"),
    goal,
    steps: calls.map((toolCall) => ({
      id: createId("step"),
      toolCall
    })),
    decision
  };
}

export function createPlanFromIntent(
  goal: string,
  decision: PlanningDecision
): ExecutionPlan {
  const { intent } = decision;

  if (intent.type === "write") {
    return createExecutionPlan(
      goal,
      [
        {
          toolName: "write_file",
          input: {
            path: intent.target?.path ?? "scratch/agent-output.txt",
            content: String(intent.inputs.content ?? `Generated by lotClaw for goal: ${goal}\n`),
            createDirectories: Boolean(intent.inputs.createDirectories ?? true)
          }
        },
        {
          toolName: "finish",
          input: {
            summary: intent.summary
          }
        }
      ],
      decision
    );
  }

  if (intent.type === "patch") {
    return createExecutionPlan(
      goal,
      [
        {
          toolName: "patch_file",
          input: {
            path: intent.target?.path ?? "README.md",
            find: String(intent.inputs.find ?? ""),
            replace: String(intent.inputs.replace ?? "")
          }
        },
        {
          toolName: "finish",
          input: {
            summary: intent.summary
          }
        }
      ],
      decision
    );
  }

  if (intent.type === "read") {
    return createExecutionPlan(
      goal,
      [
        {
          toolName: "read_file",
          input: {
            path: intent.target?.path ?? "README.md"
          }
        },
        {
          toolName: "finish",
          input: {
            summary: intent.summary
          }
        }
      ],
      decision
    );
  }

  if (intent.type === "analyze") {
    return createExecutionPlan(
      goal,
      [
        {
          toolName: "list_dir",
          input: {
            path: intent.target?.path ?? "."
          }
        },
        {
          toolName: "read_file",
          input: {
            path: String(intent.inputs.followUpPath ?? "README.md")
          }
        },
        {
          toolName: "finish",
          input: {
            summary: intent.summary
          }
        }
      ],
      decision
    );
  }

  return createExecutionPlan(
    goal,
    [
      {
        toolName: "list_dir",
        input: {
          path: intent.target?.path ?? "."
        }
      },
      {
        toolName: "finish",
        input: {
          summary: intent.summary
        }
      }
    ],
    decision
  );
}

function createEvent(type: string, payload: unknown): RuntimeEvent {
  return {
    id: createId("evt"),
    type,
    createdAt: nowIso(),
    payload
  };
}

function extractFinalOutput(steps: Array<ToolExecutionResult>): string | undefined {
  const finishStep = steps.find((step) => step.tool.name === "finish");
  const finishData = finishStep?.result.data as { summary?: string } | undefined;

  if (finishData?.summary) {
    return finishData.summary;
  }

  const lastStep = steps.at(-1);

  if (!lastStep?.result.ok) {
    return lastStep?.result.error?.message;
  }

  return JSON.stringify(lastStep.result.data, null, 2);
}

function toToolDescriptors(registry: ToolRegistry): ToolDescriptor[] {
  return registry.list().map((tool) => ({
    name: tool.name,
    description: tool.description,
    permission: tool.permission
  }));
}

function toObservation(step: ToolExecutionResult): ActionObservation {
  return {
    toolName: step.tool.name,
    ok: step.result.ok,
    summary: step.result.ok
      ? `${step.tool.name} completed successfully.`
      : step.result.error?.message ?? `${step.tool.name} failed.`,
    data: step.result.data,
    errorCode: step.result.error?.code
  };
}

function matchesAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}

function isToolCallAction(action: NextAction): action is Extract<NextAction, { type: "tool_call" }> {
  return action.type === "tool_call";
}
