import { AGENT_REGISTRY } from "../../shared/agentRegistry.js";
import type { AgentEvent, Task, TaskStatus } from "../../shared/types.js";

const ROLE_COLORS: Record<string, string> = Object.fromEntries(AGENT_REGISTRY.map((a) => [a.role, a.color]));

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  pending: "#888888",
  in_progress: "#3498db",
  done: "#2ecc71",
  failed: "#e74c3c",
};

const FILE_ACTION_ICONS: Record<string, string> = {
  edit: "✏️",
  create: "📄",
  delete: "🗑️",
};

const MAX_LOG_ENTRIES = 200;

interface AgentNameMap {
  [agentId: string]: { name: string; role: string };
}

export class SidePanel {
  private taskBody: HTMLDivElement;
  private logBody: HTMLDivElement;
  private fileBody: HTMLDivElement;
  private agentNames: AgentNameMap = {};

  constructor(container: HTMLElement) {
    container.innerHTML = "";

    const taskSection = this.createSection("Task Board", false);
    this.taskBody = taskSection.body;
    container.appendChild(taskSection.el);

    const logSection = this.createSection("Agent Log", false);
    this.logBody = logSection.body;
    container.appendChild(logSection.el);

    const fileSection = this.createSection("File Changes", true);
    this.fileBody = fileSection.body;
    container.appendChild(fileSection.el);

    this.renderEmptyTasks();
  }

  setAgentNames(agents: { id: string; name: string; role: string }[]): void {
    this.agentNames = {};
    for (const a of agents) {
      this.agentNames[a.id] = { name: a.name, role: a.role };
    }
  }

  updateTasks(tasks: Task[]): void {
    this.taskBody.innerHTML = "";

    const groups: Record<TaskStatus, Task[]> = {
      in_progress: [],
      pending: [],
      done: [],
      failed: [],
    };

    for (const task of tasks) {
      groups[task.status].push(task);
    }

    const labels: Record<TaskStatus, string> = {
      in_progress: "In Progress",
      pending: "Pending",
      done: "Done",
      failed: "Failed",
    };

    let hasAny = false;
    for (const status of ["in_progress", "pending", "done", "failed"] as TaskStatus[]) {
      const list = groups[status];
      if (list.length === 0) continue;
      hasAny = true;

      const groupLabel = document.createElement("div");
      groupLabel.className = "task-group-label";
      groupLabel.textContent = labels[status];
      this.taskBody.appendChild(groupLabel);

      for (const task of list) {
        this.taskBody.appendChild(this.createTaskItem(task));
      }
    }

    if (!hasAny) {
      this.renderEmptyTasks();
    }
  }

  addEvent(event: AgentEvent): void {
    const entry = this.createLogEntry(event);
    this.logBody.prepend(entry);

    while (this.logBody.children.length > MAX_LOG_ENTRIES && this.logBody.lastChild) {
      this.logBody.removeChild(this.logBody.lastChild);
    }
  }

  addUserCommand(text: string): void {
    const entry = document.createElement("div");
    entry.className = "log-entry";

    const time = document.createElement("span");
    time.className = "log-time";
    time.textContent = formatTime(Date.now());

    const agent = document.createElement("span");
    agent.className = "log-agent";
    agent.style.color = "#2ecc71";
    agent.textContent = "You";

    const detail = document.createElement("span");
    detail.className = "log-detail";
    detail.textContent = text;

    entry.append(time, agent, detail);
    this.logBody.prepend(entry);
  }

  loadEvents(events: AgentEvent[]): void {
    this.logBody.innerHTML = "";
    const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);
    for (const event of sorted) {
      this.logBody.appendChild(this.createLogEntry(event));
    }
  }

  addFileChange(filePath: string, action: string): void {
    const entry = document.createElement("div");
    entry.className = "file-entry";

    const icon = document.createElement("span");
    icon.className = "file-icon";
    icon.textContent = FILE_ACTION_ICONS[action] ?? "📄";

    const path = document.createElement("span");
    path.className = "file-path";
    path.textContent = filePath;

    entry.append(icon, path);
    this.fileBody.prepend(entry);
  }

  private createSection(title: string, collapsed: boolean): { el: HTMLDivElement; body: HTMLDivElement } {
    const section = document.createElement("div");
    section.className = `panel-section${collapsed ? " collapsed" : ""}`;

    const header = document.createElement("div");
    header.className = "panel-section-header";

    const chevron = document.createElement("span");
    chevron.className = "chevron";
    chevron.textContent = "▼";

    const label = document.createElement("span");
    label.textContent = title;

    header.append(chevron, label);
    header.addEventListener("click", () => {
      section.classList.toggle("collapsed");
    });

    const body = document.createElement("div");
    body.className = "panel-section-body";

    section.append(header, body);
    return { el: section, body };
  }

  private createTaskItem(task: Task): HTMLDivElement {
    const item = document.createElement("div");
    item.className = "task-item";

    const dot = document.createElement("span");
    dot.className = "task-dot";
    dot.style.background = STATUS_DOT_COLORS[task.status];

    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title;

    const assignee = document.createElement("span");
    assignee.className = "task-assignee";
    if (task.assignedTo && this.agentNames[task.assignedTo]) {
      assignee.textContent = this.agentNames[task.assignedTo].role;
    }

    item.append(dot, title, assignee);
    return item;
  }

  private createLogEntry(event: AgentEvent): HTMLDivElement {
    const entry = document.createElement("div");
    entry.className = "log-entry";

    const time = document.createElement("span");
    time.className = "log-time";
    time.textContent = formatTime(event.timestamp);

    const agent = document.createElement("span");
    agent.className = "log-agent";
    const info = this.agentNames[event.agentId];
    agent.textContent = info?.role ?? event.agentId;
    agent.style.color = info ? (ROLE_COLORS[info.role] ?? "#aaaacc") : "#aaaacc";

    const role = document.createElement("span");
    role.className = "log-role";
    role.textContent = info ? `[${info.role}]` : "";

    const detail = document.createElement("span");
    detail.className = "log-detail";
    detail.textContent = `${event.eventType}: ${event.detail}`;

    if (event.eventType === "error") {
      detail.style.color = "#e74c3c";
    }

    entry.append(time, agent, role, detail);
    return entry;
  }

  private renderEmptyTasks(): void {
    this.taskBody.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "task-empty";
    empty.textContent = "No tasks yet. Send a command to get started.";
    this.taskBody.appendChild(empty);
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}
