import {
  AgentExecutor,
  ModelBackedPlanner,
  RuleBasedPlanner,
  createPlanFromIntent,
  createRuntimeBanner
} from "@lotclaw/agent-core";
import { createDefaultTools, ToolRegistry } from "@lotclaw/agent-tools";
import { createModelAdapter } from "@lotclaw/model-adapters";
import { loadAppConfig } from "@lotclaw/shared-config";
import { createId, nowIso } from "@lotclaw/shared-utils";

async function main() {
  const config = loadAppConfig();
  const args = process.argv.slice(2);
  const command = args[0];
  const goal = args.join(" ").trim() || "Inspect workspace skeleton";
  const plannerMode = process.env.LOTCLAW_PLANNER ?? "model";
  const executionMode = process.env.LOTCLAW_EXECUTION ?? "loop";
  const traceEnabled = process.env.LOTCLAW_TRACE === "1";
  const registry = new ToolRegistry();
  registry.registerMany(createDefaultTools());
  const executor = new AgentExecutor(registry);
  const model = createModelAdapter({
    provider: config.modelProvider,
    model: resolveProviderModel(config),
    apiKey: resolveProviderApiKey(config),
    baseURL: resolveProviderBaseUrl(config)
  });

  if (command === "doctor") {
    const providerApiKey = resolveProviderApiKey(config);
    const providerBaseUrl = resolveProviderBaseUrl(config);
    const providerModel = resolveProviderModel(config);

    console.log(createRuntimeBanner("cli"));
    console.log("lotClaw CLI doctor");
    console.log(`Model provider: ${config.modelProvider}`);
    console.log(`Model name: ${providerModel}`);
    console.log(`Base URL: ${providerBaseUrl ?? "(provider default)"}`);
    console.log(`API key present: ${providerApiKey ? "yes" : "no"}`);
    console.log(`API key length: ${providerApiKey?.length ?? 0}`);
    console.log(`API key trimmed: ${providerApiKey ? String(providerApiKey === providerApiKey.trim()) : "n/a"}`);
    console.log(`Planner mode: ${plannerMode}`);
    console.log(`Execution mode: ${executionMode}`);
    console.log(`Trace enabled: ${traceEnabled ? "yes" : "no"}`);
    return;
  }

  if (command === "chat") {
    const message = args.slice(1).join(" ").trim();
    if (!message) {
      throw new Error('Usage: node apps/cli/dist/apps/cli/src/index.js chat "<message>"');
    }

    const response = await model.generateText({
      systemPrompt: "You are a concise, practical software engineering assistant.",
      messages: [
        {
          id: createId("msg"),
          role: "user",
          content: message,
          createdAt: nowIso()
        }
      ]
    });

    console.log(createRuntimeBanner("cli"));
    console.log("lotClaw CLI chat test is ready.");
    console.log(`Model provider: ${model.name}`);
    console.log(`Message: ${message}`);
    console.log(`Reply: ${response.outputText}`);
    return;
  }
  const planner =
    plannerMode === "rules"
      ? new RuleBasedPlanner()
      : new ModelBackedPlanner(model);
  const cwd = process.cwd();
  let plan = await planner.createPlan({ goal });
  let output;

  if (executionMode === "loop" && plannerMode !== "rules") {
    const decision = await new ModelBackedPlanner(model).createDecision({ goal });
    plan = createPlanFromIntent(goal, decision);
    output = await executor.executeLoop({
      goal,
      intent: decision.intent,
      model,
      context: {
        workspaceRoot: cwd
      }
    });
  } else {
    output = await executor.execute({
      goal: plan.goal,
      plan,
      context: {
        workspaceRoot: cwd
      }
    });
  }

  console.log(createRuntimeBanner("cli"));
  console.log("lotClaw CLI tool framework demo is ready.");
  console.log(`Goal: ${goal}`);
  console.log(`Planner mode: ${plannerMode}`);
  console.log(`Execution mode: ${executionMode}`);
  console.log(`Model provider: ${model.name}`);
  console.log(`Registered tools: ${registry.list().length}`);
  console.log(`Planned steps: ${plan.steps.map((step) => step.toolCall.toolName).join(" -> ")}`);
  if (plan.decision) {
    console.log(`Planner confidence: ${plan.decision.confidence}`);
    console.log(`Planner reasoning: ${plan.decision.reasoning}`);
  }
  console.log(`Executor status: ${executor.getStatus()}`);
  console.log(`Final output: ${output.finalOutput}`);
  console.log(`Events emitted: ${output.events.length}`);
  if (traceEnabled) {
    console.log("Event trace:");
    for (const event of output.events) {
      console.log(JSON.stringify(event));
    }
  }
}

main().catch((error) => {
  console.error("CLI failed to start.", error);
  process.exitCode = 1;
});

function resolveProviderApiKey(config: ReturnType<typeof loadAppConfig>): string | undefined {
  if (config.modelProvider === "openai") {
    return sanitizeEnv(config.openaiApiKey);
  }

  if (config.modelProvider === "minimax") {
    return sanitizeEnv(config.minimaxApiKey);
  }

  if (config.modelProvider === "qwen") {
    return sanitizeEnv(config.qwenApiKey);
  }

  return undefined;
}

function resolveProviderBaseUrl(config: ReturnType<typeof loadAppConfig>): string | undefined {
  if (config.modelProvider === "openai") {
    return sanitizeEnv(config.openaiBaseUrl);
  }

  if (config.modelProvider === "minimax") {
    return sanitizeEnv(config.minimaxBaseUrl);
  }

  if (config.modelProvider === "qwen") {
    return sanitizeEnv(config.qwenBaseUrl);
  }

  return undefined;
}

function resolveProviderModel(config: ReturnType<typeof loadAppConfig>): string {
  if (config.modelProvider === "minimax") {
    return sanitizeEnv(config.minimaxModel) ?? "MiniMax-M2.5";
  }

  if (config.modelProvider === "qwen") {
    return sanitizeEnv(config.qwenModel) ?? "qwen-plus";
  }

  return sanitizeEnv(config.modelName) ?? "gpt-5.4";
}

function sanitizeEnv(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
