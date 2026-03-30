import {
  AgentExecutor,
  ModelBackedPlanner,
  RuleBasedPlanner,
  createPlanFromIntent,
  createRuntimeBanner
} from "@lotclaw/agent-core";
import { createDefaultTools, ToolRegistry } from "@lotclaw/agent-tools";
import { StubModelAdapter } from "@lotclaw/model-adapters";

async function main() {
  const goal = process.argv.slice(2).join(" ").trim() || "Inspect workspace skeleton";
  const plannerMode = process.env.LOTCLAW_PLANNER ?? "model";
  const executionMode = process.env.LOTCLAW_EXECUTION ?? "loop";
  const registry = new ToolRegistry();
  registry.registerMany(createDefaultTools());
  const executor = new AgentExecutor(registry);
  const model = new StubModelAdapter();
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
  console.log(`Registered tools: ${registry.list().length}`);
  console.log(`Planned steps: ${plan.steps.map((step) => step.toolCall.toolName).join(" -> ")}`);
  if (plan.decision) {
    console.log(`Planner confidence: ${plan.decision.confidence}`);
    console.log(`Planner reasoning: ${plan.decision.reasoning}`);
  }
  console.log(`Executor status: ${executor.getStatus()}`);
  console.log(`Final output: ${output.finalOutput}`);
  console.log(`Events emitted: ${output.events.length}`);
}

main().catch((error) => {
  console.error("CLI failed to start.", error);
  process.exitCode = 1;
});
