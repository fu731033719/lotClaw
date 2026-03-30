export type AgentRole = "system" | "user" | "assistant" | "tool";

export interface AgentMessage {
  id: string;
  role: AgentRole;
  content: string;
  createdAt: string;
}

export type TaskStatus =
  | "pending"
  | "running"
  | "waiting_for_tool"
  | "waiting_for_user"
  | "completed"
  | "failed";

export interface RuntimeEvent<TPayload = unknown> {
  id: string;
  type: string;
  createdAt: string;
  payload: TPayload;
}

