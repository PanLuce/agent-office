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
} from "../src/server/state.js";

describe("agent seeding", () => {
  it("should seed 6 agents", () => {
    const agents = getAgents();
    expect(agents).toHaveLength(6);
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
    const task = createTask("Design API", "agent-architect");

    expect(task.assignedTo).toBe("agent-architect");
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
    assignTask(task.id, "agent-dev1");

    const tasks = getTasks();
    const updated = tasks.find((t) => t.id === task.id);

    expect(updated?.assignedTo).toBe("agent-dev1");
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
    assignTask(task.id, "agent-dev2");
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
    assignTask(t1.id, "agent-dev1");
    const t2 = createTask("Pending 1");
    const t3 = createTask("Done 1");
    assignTask(t3.id, "agent-dev2");
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
    assignTask(t2.id, "agent-dev1");

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
