import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { FullStatePayload, WSMessage } from "../shared/types.js";
import type { AgentManager } from "./agentManager.js";
import { addEvent, getAgents, getRecentEvents, getTasks } from "./state.js";

const BATCH_INTERVAL_MS = 50;

let wss: WebSocketServer;
let agentManagerRef: AgentManager | null = null;
let pendingMessages: WSMessage[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

export function attachWebSocket(server: Server, agentManager: AgentManager): void {
  agentManagerRef = agentManager;
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("[ws] Client connected");

    const state: FullStatePayload = {
      agents: getAgents(),
      tasks: getTasks(),
      events: getRecentEvents(50),
      workingDirectory: agentManager.getWorkingDirectory(),
    };

    send(ws, { type: "full_state", payload: state, timestamp: Date.now() });

    ws.on("message", (raw) => {
      const message: WSMessage = JSON.parse(String(raw));

      switch (message.type) {
        case "start":
          handleStart(ws, message.payload as { workingDirectory: string });
          break;
        case "command":
          handleCommand(ws, message.payload as { text: string });
          break;
        case "abort":
          handleAbort(ws);
          break;
      }
    });

    ws.on("close", () => {
      console.log("[ws] Client disconnected");
    });
  });
}

function handleStart(ws: WebSocket, payload: { workingDirectory: string }): void {
  if (!agentManagerRef) return;

  const dir = payload.workingDirectory;
  agentManagerRef.setWorkingDirectory(dir);

  const now = Date.now();
  const dirname = dir.split("/").pop() ?? dir;

  addEvent({
    agentId: "system",
    eventType: "connected",
    detail: `Connected to project: ${dirname}`,
    timestamp: now,
  });

  broadcast({
    type: "event",
    payload: {
      id: 0,
      agentId: "system",
      eventType: "connected",
      detail: `Connected to project: ${dirname}`,
      timestamp: now,
    },
    timestamp: now,
  });

  send(ws, {
    type: "start_ack",
    payload: { started: true, directory: dir },
    timestamp: now,
  });
}

function handleCommand(ws: WebSocket, payload: { text: string }): void {
  if (!agentManagerRef) return;

  const { text } = payload;
  console.log(`[command] Received: ${text}`);

  const now = Date.now();

  if (!agentManagerRef.getWorkingDirectory()) {
    send(ws, {
      type: "error",
      payload: { message: "Set working directory first. Enter a project path." },
      timestamp: now,
    });
    send(ws, { type: "command_ack", payload: { text }, timestamp: now });
    return;
  }

  addEvent({
    agentId: "user",
    eventType: "command",
    detail: text,
    timestamp: now,
  });

  broadcast({
    type: "event",
    payload: { id: 0, agentId: "user", eventType: "command", detail: text, timestamp: now },
    timestamp: now,
  });

  send(ws, { type: "command_ack", payload: { text }, timestamp: now });

  agentManagerRef.processCommand(text).catch((err) => {
    console.error("[agentManager] processCommand error:", err);
  });
}

function handleAbort(ws: WebSocket): void {
  if (!agentManagerRef) return;

  const count = agentManagerRef.abortAll();
  const now = Date.now();

  send(ws, {
    type: "command_ack",
    payload: { aborted: count > 0, count },
    timestamp: now,
  });

  if (count > 0) {
    addEvent({
      agentId: "user",
      eventType: "abort",
      detail: `User aborted ${count} agent(s).`,
      timestamp: now,
    });

    broadcast({
      type: "event",
      payload: {
        id: 0,
        agentId: "user",
        eventType: "abort",
        detail: `User aborted ${count} agent(s).`,
        timestamp: now,
      },
      timestamp: now,
    });
  }
}

function send(ws: WebSocket, message: WSMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function flushBatch(): void {
  batchTimer = null;
  if (pendingMessages.length === 0) return;

  const messages = pendingMessages;
  pendingMessages = [];

  const data =
    messages.length === 1
      ? JSON.stringify(messages[0])
      : JSON.stringify({ type: "batch", payload: messages, timestamp: Date.now() });

  if (!wss) return;
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

export function broadcast(message: WSMessage): void {
  pendingMessages.push(message);

  if (!batchTimer) {
    batchTimer = setTimeout(flushBatch, BATCH_INTERVAL_MS);
  }
}
