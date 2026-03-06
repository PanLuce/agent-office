import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { AgentManager } from "./agentManager.js";
import { runDemo } from "./demo.js";
import { addEvent, getActiveTasks, getAgent, getAgents, getTasks, upsertAgent } from "./state.js";
import { attachWebSocket, broadcast } from "./websocket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AppContext {
  app: express.Express;
  server: Server;
  agentManager: AgentManager;
}

const serverStartTime = Date.now();

function getUptime(): number {
  return Math.floor((Date.now() - serverStartTime) / 1000);
}

export function createApp(): AppContext {
  const agentManager = new AgentManager({
    onStatusChange: (agentId, status, talkingTo) => {
      const agent = getAgent(agentId);
      if (!agent) return;

      agent.status = status;
      agent.talkingTo = talkingTo ?? null;
      upsertAgent(agent);

      broadcast({ type: "agent_update", payload: agent, timestamp: Date.now() });
    },

    onEvent: (agentId, eventType, detail) => {
      const now = Date.now();
      addEvent({ agentId, eventType, detail, timestamp: now });
      broadcast({
        type: "event",
        payload: { id: 0, agentId, eventType, detail, timestamp: now },
        timestamp: now,
      });
    },

    onFileChange: (filePath, action, agentId) => {
      broadcast({
        type: "file_change",
        payload: { filePath, action, agentId, timestamp: Date.now() },
        timestamp: Date.now(),
      });
    },

    onTaskChange: () => {
      broadcast({
        type: "task_update",
        payload: { tasks: getTasks() },
        timestamp: Date.now(),
      });
    },
  });

  const app = express();
  app.use(express.json());

  const server = createServer(app);
  attachWebSocket(server, agentManager);

  const clientDistPath = path.resolve(__dirname, "../../../dist/client");
  app.use(express.static(clientDistPath));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: getUptime(),
      agents: getAgents().length,
      activeTasks: getActiveTasks().length,
    });
  });

  app.get("/api/status", (_req, res) => {
    const agents = getAgents();
    const tasks = getTasks();
    const activeTasks = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
    const completedTasks = tasks.filter((t) => t.status === "done");
    const failedTasks = tasks.filter((t) => t.status === "failed");

    res.json({
      running: true,
      workingDirectory: agentManager.getWorkingDirectory(),
      uptime: getUptime(),
      activeTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        status: a.status,
        currentTask: a.currentTask,
      })),
    });
  });

  app.get("/api/demo", (_req, res) => {
    const result = runDemo();
    res.json(result);
  });

  app.post("/api/start", (req, res) => {
    const { workingDirectory } = req.body as { workingDirectory: string };
    agentManager.setWorkingDirectory(workingDirectory);
    const dirname = path.basename(workingDirectory);
    const now = Date.now();

    addEvent({ agentId: "system", eventType: "connected", detail: `Connected to project: ${dirname}`, timestamp: now });
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

    res.json({ started: true, directory: workingDirectory });
  });

  app.post("/api/command", (req, res) => {
    const { text } = req.body as { text: string };

    if (!agentManager.getWorkingDirectory()) {
      res.json({ error: "Set working directory first via /api/start" });
      return;
    }

    agentManager.processCommand(text).catch((err) => {
      console.error("[api/command] error:", err);
    });

    res.json({ received: true, queued: true });
  });

  app.post("/api/abort", (_req, res) => {
    const count = agentManager.abortAll();
    if (count > 0) {
      const now = Date.now();
      addEvent({ agentId: "user", eventType: "abort", detail: `User aborted ${count} agent(s).`, timestamp: now });
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

      // Reset all agents to idle
      for (const agent of getAgents()) {
        if (agent.status !== "idle") {
          agent.status = "idle";
          agent.talkingTo = null;
          upsertAgent(agent);
          broadcast({ type: "agent_update", payload: agent, timestamp: now });
        }
      }
    }
    res.json({ aborted: count > 0, count });
  });

  app.get("/api/agent-status", (_req, res) => {
    res.json(agentManager.getStatus());
  });

  // SPA fallback: serve index.html for non-API routes
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });

  return { app, server, agentManager };
}
