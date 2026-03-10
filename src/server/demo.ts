import { ALL_AGENT_IDS } from "../shared/agentRegistry.js";
import type { AgentStatus } from "../shared/types.js";
import { addEvent, getAgent, upsertAgent } from "./state.js";
import { broadcast } from "./websocket.js";

let demoRunning = false;

interface DemoStep {
  delay: number;
  agentId: string;
  status: AgentStatus;
  talkingTo?: string;
  event: string;
}

const DEMO_STEPS: DemoStep[] = [
  { delay: 0, agentId: "agent-whip", status: "thinking", event: "Whip is analyzing the request..." },
  { delay: 2000, agentId: "agent-whip", status: "talking", event: "Whip is briefing the team..." },
  { delay: 4000, agentId: "agent-architect", status: "thinking", event: "Architect is designing the approach..." },
  { delay: 6000, agentId: "agent-dev1", status: "coding", event: "Dev-1 is implementing the feature..." },
  { delay: 7000, agentId: "agent-architect", status: "coding", event: "Architect is writing design doc..." },
  { delay: 8000, agentId: "agent-dev2", status: "coding", event: "Dev-2 is building the API endpoint..." },
  { delay: 10000, agentId: "agent-reviewer", status: "reviewing", event: "Reviewer is reviewing Dev-1's code..." },
  {
    delay: 11000,
    agentId: "agent-dev1",
    status: "talking",
    talkingTo: "agent-reviewer",
    event: "Dev-1 discussing review findings with Reviewer...",
  },
  { delay: 12000, agentId: "agent-sceptic", status: "reviewing", event: "Sceptic is questioning the deployment strategy..." },
];

export const DEMO_AGENT_IDS: string[] = [...new Set(DEMO_STEPS.map((s) => s.agentId))];

function applyStep(step: DemoStep): void {
  const agent = getAgent(step.agentId);
  if (!agent) return;

  agent.status = step.status;
  agent.talkingTo = step.talkingTo ?? null;
  upsertAgent(agent);

  const now = Date.now();
  const event = { agentId: step.agentId, eventType: "status", detail: step.event, timestamp: now };
  addEvent(event);

  broadcast({ type: "agent_update", payload: agent, timestamp: now });
  broadcast({ type: "event", payload: { id: 0, ...event }, timestamp: now });
}

function resetAllAgents(): void {
  const now = Date.now();
  for (const id of ALL_AGENT_IDS) {
    const agent = getAgent(id);
    if (!agent) continue;

    agent.status = "idle";
    agent.talkingTo = null;
    upsertAgent(agent);

    const event = { agentId: id, eventType: "status", detail: "Finished, returning to idle.", timestamp: now };
    addEvent(event);

    broadcast({ type: "agent_update", payload: agent, timestamp: now });
    broadcast({ type: "event", payload: { id: 0, ...event }, timestamp: now });
  }
  demoRunning = false;
}

export function runDemo(): { started: boolean; error?: string; duration?: string } {
  if (demoRunning) {
    return { started: false, error: "demo already running" };
  }

  demoRunning = true;

  for (const step of DEMO_STEPS) {
    setTimeout(() => applyStep(step), step.delay);
  }

  setTimeout(resetAllAgents, 14000);

  return { started: true, duration: "14 seconds" };
}

export function isDemoRunning(): boolean {
  return demoRunning;
}
