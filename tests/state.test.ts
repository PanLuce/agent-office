import { describe, expect, it } from "vitest";
import {
  assignTask,
  clearTasks,
  completeTask,
  createTask,
  getActiveTasks,
  getAgent,
  getAgents,
  getPendingTasks,
  getTasks,
  syncAgentsWithRegistry,
  upsertAgent,
} from "../src/server/state.js";
import { AGENT_REGISTRY } from "../src/shared/agentRegistry.js";

describe("agent seeding", () => {
  it("should seed 5 agents", () => {
    const agents = getAgents();
    expect(agents).toHaveLength(5);
  });

  it("should have Whip agent with correct data", () => {
    const whip = getAgent("agent-whip");
    expect(whip).toBeDefined();
    expect(whip?.name).toBe("Whip");
    expect(whip?.role).toBe("Whip");
    expect(whip?.status).toBe("idle");
  });
});

describe("createTask", () => {
  it("should create a task with pending status", () => {
    const task = createTask("Build login page");

    expect(task.id).toBeTruthy();
    expect(task.title).toBe("Build login page");
    expect(task.status).toBe("pending");
    expect(task.assignedTo).toBeNull();
  });

  it("should create a task with assignee", () => {
    const task = createTask("Design API", "agent-devka");

    expect(task.assignedTo).toBe("agent-devka");
    expect(task.status).toBe("pending");
  });

  it("should persist task to database", () => {
    const task = createTask("Write tests");
    const tasks = getTasks();
    const found = tasks.find((t) => t.id === task.id);

    expect(found).toBeDefined();
    expect(found?.title).toBe("Write tests");
  });
});

describe("assignTask", () => {
  it("should set assignee and status to in_progress", () => {
    const task = createTask("Implement feature");
    assignTask(task.id, "agent-devka");

    const tasks = getTasks();
    const updated = tasks.find((t) => t.id === task.id);

    expect(updated?.assignedTo).toBe("agent-devka");
    expect(updated?.status).toBe("in_progress");
  });
});

describe("completeTask", () => {
  it("should set status to done on success", () => {
    const task = createTask("Deploy app");
    assignTask(task.id, "agent-sceptic");
    completeTask(task.id, true);

    const tasks = getTasks();
    const updated = tasks.find((t) => t.id === task.id);

    expect(updated?.status).toBe("done");
  });

  it("should set status to failed on failure", () => {
    const task = createTask("Broken task");
    assignTask(task.id, "agent-druha-devka");
    completeTask(task.id, false);

    const tasks = getTasks();
    const updated = tasks.find((t) => t.id === task.id);

    expect(updated?.status).toBe("failed");
  });
});

describe("getActiveTasks", () => {
  it("should return pending and in_progress tasks", () => {
    clearTasks();

    const t1 = createTask("Active 1");
    assignTask(t1.id, "agent-devka");
    const t2 = createTask("Pending 1");
    const t3 = createTask("Done 1");
    assignTask(t3.id, "agent-druha-devka");
    completeTask(t3.id, true);

    const active = getActiveTasks();
    const activeIds = active.map((t) => t.id);

    expect(activeIds).toContain(t1.id);
    expect(activeIds).toContain(t2.id);
    expect(activeIds).not.toContain(t3.id);
  });
});

describe("getPendingTasks", () => {
  it("should return only pending tasks", () => {
    clearTasks();

    const t1 = createTask("Pending");
    const t2 = createTask("In progress");
    assignTask(t2.id, "agent-devka");

    const pending = getPendingTasks();
    const pendingIds = pending.map((t) => t.id);

    expect(pendingIds).toContain(t1.id);
    expect(pendingIds).not.toContain(t2.id);
  });
});

describe("clearTasks", () => {
  it("should remove all tasks", () => {
    createTask("To be cleared");
    clearTasks();

    const tasks = getTasks();
    expect(tasks).toHaveLength(0);
  });
});

describe("syncAgentsWithRegistry", () => {
  it("should create missing agents from registry", () => {
    syncAgentsWithRegistry();

    for (const def of AGENT_REGISTRY) {
      const agent = getAgent(def.id);
      expect(agent, `Agent "${def.id}" should exist after sync`).toBeDefined();
      expect(agent?.role).toBe(def.role);
      expect(agent?.name).toBe(def.role);
    }
  });

  it("should remove stale agents not in registry", () => {
    // Arrange: insert a stale agent that is NOT in the registry
    upsertAgent({
      id: "agent-devops",
      name: "DevOps",
      role: "DevOps",
      status: "idle",
      currentTask: null,
      talkingTo: null,
      positionX: 100,
      positionY: 100,
    });
    expect(getAgent("agent-devops")).toBeDefined();

    // Act
    syncAgentsWithRegistry();

    // Assert: stale agent removed, registry agents still present
    expect(getAgent("agent-devops")).toBeUndefined();
    expect(getAgents()).toHaveLength(AGENT_REGISTRY.length);
  });

  it("should update existing agents with current registry data", () => {
    syncAgentsWithRegistry();

    for (const def of AGENT_REGISTRY) {
      const agent = getAgent(def.id);
      expect(agent?.positionX).toBe(def.defaultPosition.x);
      expect(agent?.positionY).toBe(def.defaultPosition.y);
    }
  });
});
