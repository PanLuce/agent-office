import { describe, expect, it } from "vitest";
import { getToolsForRole, parseTaskAssignments, resolveAgentId } from "../src/server/agentManager.js";

describe("parseTaskAssignments", () => {
  it("should parse single task block", () => {
    const text = `Let me analyze this and delegate.
\`\`\`task
{"assign": "Dev-1", "task": "Build the login form component"}
\`\`\``;

    const tasks = parseTaskAssignments(text);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].assign).toBe("Dev-1");
    expect(tasks[0].task).toBe("Build the login form component");
  });

  it("should parse multiple task blocks", () => {
    const text = `Breaking this into subtasks:
\`\`\`task
{"assign": "Architect", "task": "Design the API schema"}
\`\`\`
\`\`\`task
{"assign": "Dev-1", "task": "Build the frontend"}
\`\`\`
\`\`\`task
{"assign": "Dev-2", "task": "Build the backend"}
\`\`\`
\`\`\`task
{"assign": "self", "task": "Coordinate and review"}
\`\`\``;

    const tasks = parseTaskAssignments(text);

    expect(tasks).toHaveLength(4);
    expect(tasks[0].assign).toBe("Architect");
    expect(tasks[3].assign).toBe("self");
  });

  it("should skip malformed JSON blocks", () => {
    const text = `Here's the plan:
\`\`\`task
not valid json
\`\`\`
\`\`\`task
{"assign": "Dev-1", "task": "Valid task"}
\`\`\``;

    const tasks = parseTaskAssignments(text);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].assign).toBe("Dev-1");
  });

  it("should return empty array when no task blocks", () => {
    const text = "I'll handle this myself, no delegation needed.";
    const tasks = parseTaskAssignments(text);

    expect(tasks).toHaveLength(0);
  });

  it("should handle task blocks with extra whitespace", () => {
    const text = `\`\`\`task
  { "assign": "Reviewer", "task": "Review code quality" }
\`\`\``;

    const tasks = parseTaskAssignments(text);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].assign).toBe("Reviewer");
  });
});

describe("resolveAgentId", () => {
  it("should resolve Dev-1 to agent-dev1", () => {
    expect(resolveAgentId("Dev-1")).toBe("agent-dev1");
  });

  it("should resolve Dev-2 to agent-dev2", () => {
    expect(resolveAgentId("Dev-2")).toBe("agent-dev2");
  });

  it("should resolve Architect to agent-architect", () => {
    expect(resolveAgentId("Architect")).toBe("agent-architect");
  });

  it("should resolve Reviewer to agent-reviewer", () => {
    expect(resolveAgentId("Reviewer")).toBe("agent-reviewer");
  });

  it("should resolve Sceptic to agent-sceptic", () => {
    expect(resolveAgentId("Sceptic")).toBe("agent-sceptic");
  });

  it("should return null for unknown agent names", () => {
    expect(resolveAgentId("Unknown")).toBeNull();
  });

  it("should return null for self", () => {
    expect(resolveAgentId("self")).toBeNull();
  });
});

describe("getToolsForRole", () => {
  it("should give Architect read-focused tools", () => {
    const tools = getToolsForRole("Architect");

    expect(tools).toContain("Read");
    expect(tools).toContain("Write");
    expect(tools).toContain("Glob");
    expect(tools).toContain("Grep");
  });

  it("should give Dev-1 full coding tools", () => {
    const tools = getToolsForRole("Dev-1");

    expect(tools).toContain("Read");
    expect(tools).toContain("Write");
    expect(tools).toContain("Edit");
    expect(tools).toContain("MultiEdit");
    expect(tools).toContain("Bash");
  });

  it("should give Reviewer review tools", () => {
    const tools = getToolsForRole("Reviewer");

    expect(tools).toContain("Read");
    expect(tools).toContain("Glob");
    expect(tools).toContain("Grep");
    expect(tools).toContain("Write");
  });

  it("should return default tools for unknown roles", () => {
    const tools = getToolsForRole("Unknown");

    expect(tools).toContain("Read");
    expect(tools.length).toBeGreaterThan(0);
  });
});
