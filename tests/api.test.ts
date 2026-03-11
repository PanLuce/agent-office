import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

describe("GET /api/health", () => {
  it("should return ok status with uptime and counts", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.agents).toBe(5);
    expect(typeof body.activeTasks).toBe("number");
  });
});

describe("GET /api/status", () => {
  it("should return full status with agents", async () => {
    const res = await fetch(`${baseUrl}/api/status`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.running).toBe(true);
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(typeof body.activeTasks).toBe("number");
    expect(typeof body.completedTasks).toBe("number");
    expect(typeof body.failedTasks).toBe("number");
    expect(body.agents).toHaveLength(5);
  });

  it("should include agent details in status", async () => {
    const res = await fetch(`${baseUrl}/api/status`);
    const body = await res.json();

    const whip = body.agents.find((a: { role: string }) => a.role === "Whip");
    expect(whip).toBeDefined();
    expect(whip.name).toBe("Whip");
    expect(whip.status).toBe("idle");
  });
});

describe("GET /api/agent-status", () => {
  it("should return null working directory initially", async () => {
    const res = await fetch(`${baseUrl}/api/agent-status`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.workingDirectory).toBeNull();
    expect(body.busy).toEqual({});
  });
});

describe("POST /api/start", () => {
  it("should set the working directory", async () => {
    const res = await fetch(`${baseUrl}/api/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workingDirectory: "/tmp/test-project" }),
    });
    const body = await res.json();

    expect(body.started).toBe(true);
    expect(body.directory).toBe("/tmp/test-project");
  });

  it("should reflect working directory in agent-status", async () => {
    const res = await fetch(`${baseUrl}/api/agent-status`);
    const body = await res.json();

    expect(body.workingDirectory).toContain("test-project");
  });
});

describe("POST /api/command", () => {
  it("should reject command when no working directory is set", async () => {
    const freshServer = await startTestServer();

    const res = await fetch(`${freshServer.baseUrl}/api/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "do something" }),
    });
    const body = await res.json();

    expect(body.error).toContain("Set working directory first");

    await freshServer.close();
  });
});

describe("POST /api/abort", () => {
  it("should return aborted false when nothing is running", async () => {
    const res = await fetch(`${baseUrl}/api/abort`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const body = await res.json();

    expect(body.aborted).toBe(false);
    expect(body.count).toBe(0);
  });
});

describe("GET /api/demo", () => {
  it("should start the demo sequence", async () => {
    const res = await fetch(`${baseUrl}/api/demo`);
    const body = await res.json();

    expect(body.started).toBe(true);
    expect(body.duration).toBe("12 seconds");
  });

  it("should reject concurrent demo runs", async () => {
    const res = await fetch(`${baseUrl}/api/demo`);
    const body = await res.json();

    expect(body.started).toBe(false);
    expect(body.error).toBe("demo already running");
  });
});
