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
    id: "agent-architect",
    role: "Architect",
    configSlug: "architect",
    shortLabel: "AR",
    keyBinding: "2",
    specialty: "system design, API design, documentation, planning",
    defaultTools: ["Read", "Glob", "Grep", "Write"],
    defaultPosition: { x: 240, y: 99 },
    color: "#3498db",
    shirtColor: "#3498db",
  },
  {
    id: "agent-dev1",
    role: "Dev-1",
    configSlug: "dev-1",
    shortLabel: "D1",
    keyBinding: "3",
    specialty: "frontend development, React, UI components",
    defaultTools: ["Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep"],
    defaultPosition: { x: 385, y: 106 },
    color: "#2ecc71",
    shirtColor: "#2ecc71",
  },
  {
    id: "agent-dev2",
    role: "Dev-2",
    configSlug: "dev-2",
    shortLabel: "D2",
    keyBinding: "4",
    specialty: "backend development, APIs, databases, server code",
    defaultTools: ["Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep"],
    defaultPosition: { x: 95, y: 219 },
    color: "#27ae60",
    shirtColor: "#27ae60",
  },
  {
    id: "agent-reviewer",
    role: "Reviewer",
    configSlug: "reviewer",
    shortLabel: "UB",
    keyBinding: "5",
    specialty: "clean code review, code quality, refactoring suggestions",
    defaultTools: ["Read", "Glob", "Grep", "Write"],
    defaultPosition: { x: 238, y: 224 },
    color: "#f39c12",
    shirtColor: "#f39c12",
  },
  {
    id: "agent-sceptic",
    role: "Sceptic",
    configSlug: "sceptic",
    shortLabel: "SC",
    keyBinding: "6",
    specialty: "questioning decisions, challenging assumptions, critical analysis of solutions and workflow",
    defaultTools: ["Read", "Glob", "Grep"],
    defaultPosition: { x: 380, y: 216 },
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
