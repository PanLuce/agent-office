export interface AgentDefinition {
  id: string;
  role: string;
  configSlug: string;
  shortLabel: string;
  keyBinding: string;
  specialty: string;
  defaultTools: string[];
  defaultPosition: { x: number; y: number };
  color: string;
  shirtColor: string;
}

export const AGENT_REGISTRY: AgentDefinition[] = [
  {
    id: "agent-whip",
    role: "Whip",
    configSlug: "whip",
    shortLabel: "WH",
    keyBinding: "1",
    specialty: "team coordination, task delegation",
    defaultTools: ["Read", "Glob", "Grep"],
    defaultPosition: { x: 90, y: 104 },
    color: "#e74c3c",
    shirtColor: "#e8e8e8",
  },
  {
    id: "agent-devka",
    role: "devka",
    configSlug: "devka",
    shortLabel: "devka",
    keyBinding: "2",
    specialty: "frontend development, React, UI components",
    defaultTools: ["Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep"],
    defaultPosition: { x: 240, y: 99 },
    color: "#2ecc71",
    shirtColor: "#2ecc71",
  },
  {
    id: "agent-druha-devka",
    role: "druhá devka",
    configSlug: "druha-devka",
    shortLabel: "druhá devka",
    keyBinding: "3",
    specialty: "backend development, APIs, databases, server code",
    defaultTools: ["Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep"],
    defaultPosition: { x: 385, y: 106 },
    color: "#27ae60",
    shirtColor: "#27ae60",
  },
  {
    id: "agent-reviewer",
    role: "Reviewer",
    configSlug: "reviewer",
    shortLabel: "UB",
    keyBinding: "4",
    specialty: "clean code review, code quality, refactoring suggestions",
    defaultTools: ["Read", "Glob", "Grep", "Write"],
    defaultPosition: { x: 95, y: 219 },
    color: "#f39c12",
    shirtColor: "#f39c12",
  },
  {
    id: "agent-sceptic",
    role: "Sceptic",
    configSlug: "sceptic",
    shortLabel: "SC",
    keyBinding: "5",
    specialty: "questioning decisions, challenging assumptions, critical analysis of solutions and workflow",
    defaultTools: ["Read", "Glob", "Grep"],
    defaultPosition: { x: 238, y: 224 },
    color: "#e67e22",
    shirtColor: "#e67e22",
  },
];

export const AGENT_BY_ID: Record<string, AgentDefinition> = Object.fromEntries(AGENT_REGISTRY.map((a) => [a.id, a]));

export const AGENT_BY_ROLE: Record<string, AgentDefinition> = Object.fromEntries(
  AGENT_REGISTRY.map((a) => [a.role, a]),
);

export const ALL_AGENT_IDS: string[] = AGENT_REGISTRY.map((a) => a.id);

export function buildTeamDescription(): string {
  return AGENT_REGISTRY.filter((a) => a.role !== "Whip")
    .map((a) => `- ${a.role}: ${a.specialty}`)
    .join("\n");
}
