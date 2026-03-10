import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { FullStatePayload, WSMessage } from "../src/shared/types.js";
import { startTestServer } from "./helpers.js";

let wsUrl: string;
let close: () => Promise<void>;

beforeAll(async () => {
  const ctx = await startTestServer();
  wsUrl = ctx.wsUrl;
  close = ctx.close;
});

afterAll(async () => {
  await close();
});

function connectAndReceive(url: string): Promise<WSMessage> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on("message", (data) => {
      const message: WSMessage = JSON.parse(String(data));
      ws.close();
      resolve(message);
    });
    ws.on("error", reject);
    setTimeout(() => {
      ws.close();
      reject(new Error("Timed out waiting for message"));
    }, 5000);
  });
}

function connectAndExchange(url: string, send: WSMessage): Promise<WSMessage[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const messages: WSMessage[] = [];

    ws.on("message", (data) => {
      const message: WSMessage = JSON.parse(String(data));
      messages.push(message);

      if (messages.length === 1) {
        ws.send(JSON.stringify(send));
      }

      if (messages.length >= 3) {
        ws.close();
        resolve(messages);
      }
    });

    ws.on("error", reject);
    setTimeout(() => {
      ws.close();
      resolve(messages);
    }, 7350);
  });
}

describe("WebSocket connection", () => {
  it("should send full_state on connect", async () => {
    const message = await connectAndReceive(wsUrl);

    expect(message.type).toBe("full_state");
    expect(message.timestamp).toBeGreaterThan(0);
  });

  it("should include 6 agents in full_state", async () => {
    const message = await connectAndReceive(wsUrl);
    const payload = message.payload as FullStatePayload;

    expect(payload.agents).toHaveLength(6);
    expect(payload.tasks).toBeInstanceOf(Array);
    expect(payload.events).toBeInstanceOf(Array);
  });

  it("should include all expected agent roles", async () => {
    const message = await connectAndReceive(wsUrl);
    const payload = message.payload as FullStatePayload;
    const roles = payload.agents.map((a) => a.role).sort();

    expect(roles).toEqual(["Architect", "Dev-1", "Dev-2", "Reviewer", "Sceptic", "Whip"]);
  });

  it("should have all agents in idle status initially", async () => {
    const message = await connectAndReceive(wsUrl);
    const payload = message.payload as FullStatePayload;

    for (const agent of payload.agents) {
      expect(agent.status).toBe("idle");
    }
  });
});

describe("WebSocket start flow", () => {
  it("should respond with start_ack after start message", async () => {
    const messages = await connectAndExchange(wsUrl, {
      type: "start",
      payload: { workingDirectory: "/tmp/ws-test" },
      timestamp: Date.now(),
    });

    const startAck = messages.find((m) => m.type === "start_ack");
    expect(startAck).toBeDefined();

    const ackPayload = startAck?.payload as { started: boolean; directory: string };
    expect(ackPayload.started).toBe(true);
    expect(ackPayload.directory).toBe("/tmp/ws-test");
  });

  it("should broadcast connected event after start", async () => {
    const messages = await connectAndExchange(wsUrl, {
      type: "start",
      payload: { workingDirectory: "/tmp/ws-test-2" },
      timestamp: Date.now(),
    });

    const event = messages.find((m) => m.type === "event");
    expect(event).toBeDefined();

    const eventPayload = event?.payload as { agentId: string; eventType: string; detail: string };
    expect(eventPayload.agentId).toBe("system");
    expect(eventPayload.eventType).toBe("connected");
    expect(eventPayload.detail).toContain("ws-test-2");
  });
});
