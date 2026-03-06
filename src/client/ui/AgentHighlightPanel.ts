import type { Agent, AgentEvent } from "../../shared/types.js";

const ROLE_COLORS: Record<string, string> = {
  Whip: "#e74c3c",
  Architect: "#3498db",
  "Dev-1": "#2ecc71",
  "Dev-2": "#27ae60",
  Tester: "#f39c12",
  DevOps: "#9b59b6",
};

export class AgentHighlightPanel {
  private panel: HTMLDivElement;
  private visible = false;

  constructor() {
    this.panel = document.createElement("div");
    this.panel.style.cssText = `
      position: fixed;
      display: none;
      background: #1a1a2e;
      border: 1px solid #555;
      font-family: "Courier New", monospace;
      font-size: 11px;
      color: #ccc;
      max-width: 250px;
      padding: 8px;
      z-index: 150;
      pointer-events: none;
      line-height: 1.4;
    `;
    document.body.appendChild(this.panel);
  }

  show(agent: Agent, events: AgentEvent[], canvasRect: DOMRect, agentScreenX: number, agentScreenY: number): void {
    const roleColor = ROLE_COLORS[agent.role] ?? "#888";
    this.panel.style.borderColor = roleColor;

    const recentEvents = events.filter((e) => e.agentId === agent.id).slice(0, 5);

    const eventsHtml =
      recentEvents.length > 0
        ? recentEvents
            .map(
              (e) =>
                `<div style="color:#888;font-size:10px;margin-top:2px;">${e.eventType}: ${truncate(e.detail, 60)}</div>`,
            )
            .join("")
        : '<div style="color:#555;font-size:10px;">No recent events</div>';

    this.panel.innerHTML = `
      <div style="color:${roleColor};font-weight:bold;">${agent.name} — ${agent.role}</div>
      <div style="margin-top:4px;">Status: ${agent.status}</div>
      ${agent.currentTask ? `<div>Task: ${truncate(agent.currentTask, 40)}</div>` : ""}
      <div style="margin-top:6px;border-top:1px solid #333;padding-top:4px;">
        ${eventsHtml}
      </div>
    `;

    const x = canvasRect.left + agentScreenX + 20;
    const y = canvasRect.top + agentScreenY - 20;

    this.panel.style.left = `${Math.min(x, window.innerWidth - 260)}px`;
    this.panel.style.top = `${Math.max(4, y)}px`;
    this.panel.style.display = "block";
    this.visible = true;
  }

  hide(): void {
    if (!this.visible) return;
    this.panel.style.display = "none";
    this.visible = false;
  }
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 3) + "..." : text;
}
