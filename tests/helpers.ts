import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { AgentManager } from "../src/server/agentManager.js";
import { createApp } from "../src/server/app.js";

interface TestServer {
  baseUrl: string;
  wsUrl: string;
  server: Server;
  agentManager: AgentManager;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const { server, agentManager } = createApp();

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://localhost:${port}`;
  const wsUrl = `ws://localhost:${port}`;

  return {
    baseUrl,
    wsUrl,
    server,
    agentManager,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
