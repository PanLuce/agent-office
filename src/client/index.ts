import { Application, Text, TextStyle } from "pixi.js";
import type { Agent, AgentEvent, FileChangePayload, FullStatePayload, Task, WSMessage } from "../shared/types.js";
import { OfficeScene } from "./office/OfficeScene.js";
import { AgentHighlightPanel } from "./ui/AgentHighlightPanel.js";
import { CommandBar } from "./ui/CommandBar.js";
import { ConnectionOverlay } from "./ui/ConnectionOverlay.js";
import { KeyboardManager } from "./ui/KeyboardManager.js";
import { SidePanel } from "./ui/SidePanel.js";

const WS_URL = `ws://${window.location.host}`;
const RECONNECT_DELAY = 2000;
const DISCONNECT_OVERLAY_DELAY = 5000;

let statusText: Text;
let officeScene: OfficeScene;
let sidePanel: SidePanel;
let commandBar: CommandBar;
let app: Application;
let ws: WebSocket | null = null;
let connectionOverlay: ConnectionOverlay;
let highlightPanel: AgentHighlightPanel;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
let recentEvents: AgentEvent[] = [];
const knownAgents: Map<string, Agent> = new Map();

function createStatusStyle(connected: boolean): TextStyle {
  return new TextStyle({
    fontFamily: "Arial",
    fontSize: 14,
    fill: connected ? "#4ade80" : "#ef4444",
  });
}

function updateConnectionStatus(connected: boolean): void {
  if (!statusText) return;
  statusText.text = connected ? "Connected" : "Disconnected";
  statusText.style = createStatusStyle(connected);

  if (connected) {
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
    connectionOverlay.hide();
  } else {
    if (!disconnectTimer) {
      disconnectTimer = setTimeout(() => {
        connectionOverlay.show(() => connectWebSocket());
        disconnectTimer = null;
      }, DISCONNECT_OVERLAY_DELAY);
    }
  }
}

function sendWsMessage(message: WSMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function handleFullState(payload: FullStatePayload): void {
  console.log("[ws] Full state received:", payload);

  sidePanel.setAgentNames(payload.agents);
  officeScene.populate(payload.agents);
  resizeCanvas();

  sidePanel.updateTasks(payload.tasks);
  sidePanel.loadEvents(payload.events);

  recentEvents = payload.events;
  knownAgents.clear();
  for (const agent of payload.agents) {
    knownAgents.set(agent.id, agent);
  }

  if (payload.workingDirectory) {
    commandBar.handleStartAck(payload.workingDirectory);
  }
}

function handleAgentUpdate(agent: Agent): void {
  knownAgents.set(agent.id, agent);
  officeScene.updateAgent(agent);
}

function handleEvent(event: AgentEvent): void {
  sidePanel.addEvent(event);
  recentEvents.unshift(event);
  if (recentEvents.length > 100) {
    recentEvents.length = 100;
  }
}

function handleStartAck(payload: { started: boolean; directory: string }): void {
  if (payload.started) {
    commandBar.handleStartAck(payload.directory);
    sidePanel.addUserCommand(`Connected to ${payload.directory}`);
  }
}

function handleFileChange(payload: FileChangePayload): void {
  const agentInfo = payload.agentId ? ` (${payload.agentId})` : "";
  sidePanel.addFileChange(payload.filePath + agentInfo, payload.action);
}

function handleTaskUpdate(payload: { tasks: Task[] }): void {
  sidePanel.updateTasks(payload.tasks);
}

function handleError(payload: { message: string }): void {
  sidePanel.addEvent({
    id: 0,
    agentId: "system",
    eventType: "error",
    detail: payload.message,
    timestamp: Date.now(),
  });
  commandBar.setProcessing(false);
}

function handleCommandAck(): void {
  commandBar.setProcessing(false);
}

function processMessage(message: WSMessage): void {
  switch (message.type) {
    case "full_state":
      handleFullState(message.payload as FullStatePayload);
      break;
    case "agent_update":
      handleAgentUpdate(message.payload as Agent);
      break;
    case "event":
      handleEvent(message.payload as AgentEvent);
      break;
    case "start_ack":
      handleStartAck(message.payload as { started: boolean; directory: string });
      break;
    case "file_change":
      handleFileChange(message.payload as FileChangePayload);
      break;
    case "task_update":
    case "task_create":
    case "task_assign":
      handleTaskUpdate(message.payload as { tasks: Task[] });
      break;
    case "error":
      handleError(message.payload as { message: string });
      break;
    case "command_ack":
      handleCommandAck();
      break;
    case "batch":
      for (const subMessage of message.payload as WSMessage[]) {
        processMessage(subMessage);
      }
      break;
  }
}

function connectWebSocket(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  ws = new WebSocket(WS_URL);

  ws.addEventListener("open", () => {
    console.log("[ws] Connected");
    updateConnectionStatus(true);
    commandBar.autoConnect();
  });

  ws.addEventListener("message", (event) => {
    const message: WSMessage = JSON.parse(event.data as string);
    processMessage(message);
  });

  ws.addEventListener("close", () => {
    console.log("[ws] Disconnected, reconnecting...");
    updateConnectionStatus(false);
    ws = null;
    setTimeout(connectWebSocket, RECONNECT_DELAY);
  });

  ws.addEventListener("error", () => {
    ws?.close();
  });
}

function resizeCanvas(): void {
  officeScene.resize(app.screen.width, app.screen.height);
}

function initSplitter(canvasContainer: HTMLElement): void {
  const splitter = document.getElementById("splitter");
  const mainArea = document.getElementById("main-area");
  if (!splitter || !mainArea) return;

  let dragging = false;

  splitter.addEventListener("mousedown", (e) => {
    e.preventDefault();
    dragging = true;
    splitter.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;

    const mainRect = mainArea.getBoundingClientRect();
    const newWidth = Math.max(200, Math.min(e.clientX - mainRect.left, mainRect.width - 205));
    canvasContainer.style.flexBasis = `${newWidth}px`;

    app.resize();
    resizeCanvas();
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove("dragging");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });
}

async function initApp(): Promise<void> {
  const canvasContainer = document.getElementById("canvas-container");
  if (!canvasContainer) throw new Error("Missing #canvas-container element");

  app = new Application();
  await app.init({
    resizeTo: canvasContainer,
    background: "#1a1a2e",
    antialias: true,
  });

  canvasContainer.appendChild(app.canvas);

  officeScene = new OfficeScene(app.ticker);
  app.stage.addChild(officeScene);

  statusText = new Text({
    text: "Disconnected",
    style: createStatusStyle(false),
  });
  statusText.x = 12;
  statusText.y = 12;
  app.stage.addChild(statusText);

  const sidePanelEl = document.getElementById("side-panel");
  if (!sidePanelEl) throw new Error("Missing #side-panel element");
  sidePanel = new SidePanel(sidePanelEl);

  commandBar = new CommandBar(sendWsMessage, (text) => {
    sidePanel.addUserCommand(text);
  });

  connectionOverlay = new ConnectionOverlay();
  highlightPanel = new AgentHighlightPanel();

  const input = document.getElementById("command-input") as HTMLInputElement;

  new KeyboardManager(
    sendWsMessage,
    input,
    (info) => {
      if (!info) {
        officeScene.clearHighlight();
        highlightPanel.hide();
        return;
      }

      officeScene.highlightAgent(info.agentId);

      const agent = knownAgents.get(info.agentId);
      if (agent) {
        const pos = officeScene.getAgentScreenPosition(info.agentId);
        const canvas = app.canvas as HTMLCanvasElement;
        if (pos) {
          highlightPanel.show(agent, recentEvents, canvas.getBoundingClientRect(), pos.x, pos.y);
        }
      }
    },
    () => {
      if (connectionOverlay.isVisible()) {
        connectionOverlay.triggerRetry();
      }
    },
  );

  window.addEventListener("resize", resizeCanvas);

  initSplitter(canvasContainer);

  connectWebSocket();
}

initApp();
