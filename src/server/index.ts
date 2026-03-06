import { createApp } from "./app.js";
import { startWatching } from "./hookWatcher.js";
import { getAgent, upsertAgent } from "./state.js";
import { broadcast } from "./websocket.js";

const PORT = 7350;

process.on("uncaughtException", (err) => {
  console.error("[server] Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled rejection:", reason);
});

const { server } = createApp();

startWatching((event) => {
  const agent = getAgent("agent-whip");
  if (!agent) return;

  if (agent.status !== event.status) {
    agent.status = event.status;
    upsertAgent(agent);
    broadcast({ type: "agent_update", payload: agent, timestamp: Date.now() });
  }

  if (event.fileAction && event.file && event.file !== "n/a") {
    broadcast({
      type: "file_change",
      payload: { filePath: event.file, action: event.fileAction },
      timestamp: Date.now(),
    });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
