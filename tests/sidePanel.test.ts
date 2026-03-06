// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { SidePanel } from "../src/client/ui/SidePanel.js";
import type { AgentEvent } from "../src/shared/types.js";

describe("SidePanel log entries", () => {
  let panel: SidePanel;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    panel = new SidePanel(container);
    panel.setAgentNames([
      { id: "agent-whip", name: "Alice", role: "Whip" },
      { id: "agent-architect", name: "Bob", role: "Architect" },
    ]);
  });

  function getLogBody(): HTMLDivElement {
    return container.querySelector(".panel-section-body:nth-of-type(1)") as HTMLDivElement;
  }

  function getFirstLogEntry(): HTMLDivElement | null {
    const bodies = container.querySelectorAll(".panel-section-body");
    // Log is the second section (Task Board, Agent Log, File Changes)
    const logBody = bodies[1] as HTMLDivElement | undefined;
    return logBody?.querySelector(".log-entry") ?? null;
  }

  function makeEvent(overrides: Partial<AgentEvent> = {}): AgentEvent {
    return {
      id: 1,
      agentId: "agent-whip",
      eventType: "status_change",
      detail: "idle -> thinking",
      timestamp: Date.now(),
      ...overrides,
    };
  }

  it("should include a role span in log entries", () => {
    panel.addEvent(makeEvent());

    const entry = getFirstLogEntry();
    expect(entry).not.toBeNull();

    const roleSpan = entry!.querySelector(".log-role");
    expect(roleSpan).not.toBeNull();
    expect(roleSpan!.textContent).toBe("[Whip]");
  });

  it("should show correct role for different agents", () => {
    panel.addEvent(makeEvent({ agentId: "agent-architect" }));

    const entry = getFirstLogEntry();
    const roleSpan = entry!.querySelector(".log-role");
    expect(roleSpan!.textContent).toBe("[Architect]");
  });

  it("should show empty role when agent is unknown", () => {
    panel.addEvent(makeEvent({ agentId: "unknown-agent" }));

    const entry = getFirstLogEntry();
    const roleSpan = entry!.querySelector(".log-role");
    expect(roleSpan).not.toBeNull();
    expect(roleSpan!.textContent).toBe("");
  });

  it("should place role span between agent name and detail", () => {
    panel.addEvent(makeEvent());

    const entry = getFirstLogEntry();
    const children = Array.from(entry!.children);
    const classNames = children.map((c) => c.className);

    expect(classNames).toEqual(["log-time", "log-agent", "log-role", "log-detail"]);
  });

  it("should color agent name by role", () => {
    panel.addEvent(makeEvent());

    const entry = getFirstLogEntry();
    const agentSpan = entry!.querySelector(".log-agent") as HTMLSpanElement;
    expect(agentSpan.style.color).toBe("#e74c3c");
  });
});
