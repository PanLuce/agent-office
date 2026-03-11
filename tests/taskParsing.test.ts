import { describe, expect, it } from "vitest";
import { getToolsForRole, parseTaskAssignments, resolveAgentId } from "../src/server/agentManager.js";

describe("parseTaskAssignments", () => {
  it("should parse single task block", () => {
    const text = `Let me analyze this and delegate.
\`\`\`task
{"assign": "devka", "task": "Build the login form component"}
\`\`\``;

    const tasks = parseTaskAssignments(text);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].assign).toBe("devka");
    expect(tasks[0].task).toBe("Build the login form component");
  });

  it("should parse multiple task blocks", () => {
    const text = `Breaking this into subtasks:
\`\`\`task
{"assign": "devka", "task": "Build the frontend"}
\`\`\`
\`\`\`task
{"assign": "druhá devka", "task": "Build the backend"}
\`\`\`
\`\`\`task
{"assign": "Reviewer", "task": "Review the code"}
\`\`\`
\`\`\`task
{"assign": "self", "task": "Coordinate and review"}
\`\`\``;

    const tasks = parseTaskAssignments(text);

    expect(tasks).toHaveLength(4);
    expect(tasks[0].assign).toBe("devka");
    expect(tasks[3].assign).toBe("self");
  });

  it("should skip malformed JSON blocks", () => {
    const text = `Here's the plan:
\`\`\`task
not valid json
\`\`\`
\`\`\`task
{"assign": "devka", "task": "Valid task"}
\`\`\``;

    const tasks = parseTaskAssignments(text);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].assign).toBe("devka");
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
  it("should resolve devka to agent-devka", () => {
    expect(resolveAgentId("devka")).toBe("agent-devka");
  });

  it("should resolve druhá devka to agent-druha-devka", () => {
    expect(resolveAgentId("druhá devka")).toBe("agent-druha-devka");
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
  it("should give devka full coding tools", () => {
    const tools = getToolsForRole("devka");

    expect(tools).toContain("Read");
    expect(tools).toContain("Write");
    expect(tools).toContain("Edit");
    expect(tools).toContain("MultiEdit");
    expect(tools).toContain("Bash");
  });

  it("should give druhá devka full coding tools", () => {
    const tools = getToolsForRole("druhá devka");

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
