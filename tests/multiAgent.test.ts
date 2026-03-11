import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assignTask, clearTasks, completeTask, createTask, getActiveTasks, getTasks } from "../src/server/state.js";
import { startTestServer } from "./helpers.js";

let baseUrl: string;
let close: () => Promise<void>;

beforeAll(async () => {
  const ctx = await startTestServer();
  baseUrl = ctx.baseUrl;
  close = ctx.close;
});

afterAll(async () => {
  await close();
});

describe("POST /api/abort with abortAll", () => {
  it("should return count of 0 when nothing running", async () => {
    const res = await fetch(`${baseUrl}/api/abort`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const body = await res.json();

    expect(body.aborted).toBe(false);
    expect(body.count).toBe(0);
  });
});

describe("task lifecycle via state", () => {
  it("should create, assign, and complete tasks", () => {
    clearTasks();

    const task = createTask("Test multi-agent task", "agent-devka");
    expect(task.status).toBe("pending");

    assignTask(task.id, "agent-devka");
    const active = getActiveTasks();
    expect(active.some((t) => t.id === task.id)).toBe(true);

    completeTask(task.id, true);
    const allTasks = getTasks();
    const done = allTasks.find((t) => t.id === task.id);
    expect(done?.status).toBe("done");
  });
});

describe("agent-status reflects busy state", () => {
  it("should show empty busy map when no agents working", async () => {
    const res = await fetch(`${baseUrl}/api/agent-status`);
    const body = await res.json();

    expect(body.busy).toEqual({});
  });
});
