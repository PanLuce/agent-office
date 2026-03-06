export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  currentTask: string | null;
  talkingTo: string | null;
  positionX: number;
  positionY: number;
}

export type AgentStatus = "idle" | "thinking" | "coding" | "reviewing" | "talking" | "walking";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  assignedTo: string | null;
  createdAt: number;
  updatedAt: number;
}

export type TaskStatus = "pending" | "in_progress" | "done" | "failed";

export interface AgentEvent {
  id: number;
  agentId: string;
  eventType: string;
  detail: string;
  timestamp: number;
}

export interface TaskAssignment {
  taskId: string;
  agentId: string;
  agentName: string;
  role: string;
  description: string;
}

export type WSMessageType =
  | "full_state"
  | "agent_update"
  | "task_update"
  | "task_create"
  | "task_assign"
  | "event"
  | "command"
  | "command_ack"
  | "start"
  | "start_ack"
  | "abort"
  | "file_change"
  | "error"
  | "batch";

export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
  timestamp: number;
}

export interface FullStatePayload {
  agents: Agent[];
  tasks: Task[];
  events: AgentEvent[];
  workingDirectory: string | null;
}

export interface HealthResponse {
  status: "ok";
}

export interface CommandRequest {
  text: string;
}

export interface CommandResponse {
  received: true;
}

export interface FileChangePayload {
  filePath: string;
  action: "edit" | "create" | "delete";
  agentId?: string;
  timestamp?: number;
}
