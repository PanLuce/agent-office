import { AGENT_REGISTRY } from "../../shared/agentRegistry.js";
import type { WSMessage } from "../../shared/types.js";

type SendFn = (message: WSMessage) => void;

const AGENT_KEYS: Record<string, { id: string; label: string }> = Object.fromEntries(
  AGENT_REGISTRY.map((a) => [a.keyBinding, { id: a.id, label: a.role }]),
);

const HINT_STORAGE_KEY = "agent-office-shortcuts-used";

export interface AgentHighlightInfo {
  agentId: string;
  label: string;
}

export type HighlightCallback = (info: AgentHighlightInfo | null) => void;
export type RetryCallback = () => void;

export class KeyboardManager {
  private sendMessage: SendFn;
  private input: HTMLInputElement;
  private onHighlight: HighlightCallback;
  private onRetry: RetryCallback;
  private highlightedAgent: string | null = null;
  private highlightTimeout: ReturnType<typeof setTimeout> | null = null;
  private hintElement: HTMLElement | null = null;
  private hasUsedShortcut: boolean;

  constructor(sendMessage: SendFn, input: HTMLInputElement, onHighlight: HighlightCallback, onRetry: RetryCallback) {
    this.sendMessage = sendMessage;
    this.input = input;
    this.onHighlight = onHighlight;
    this.onRetry = onRetry;
    this.hasUsedShortcut = localStorage.getItem(HINT_STORAGE_KEY) === "true";

    document.addEventListener("keydown", (e) => this.handleKeyDown(e));
    this.createHint();
  }

  clearHighlight(): void {
    if (this.highlightTimeout) {
      clearTimeout(this.highlightTimeout);
      this.highlightTimeout = null;
    }
    this.highlightedAgent = null;
    this.onHighlight(null);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const mod = e.metaKey || e.ctrlKey;
    const inputFocused = document.activeElement === this.input;

    if (mod && e.key === "k") {
      e.preventDefault();
      if (inputFocused) {
        this.input.select();
      } else {
        this.input.focus();
      }
      this.markShortcutUsed();
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      if (this.highlightedAgent) {
        this.clearHighlight();
      } else if (inputFocused) {
        this.input.blur();
      } else {
        this.onRetry();
      }
      this.markShortcutUsed();
      return;
    }

    if (mod && e.key === "d" && !e.shiftKey) {
      e.preventDefault();
      fetch("/api/demo").catch(() => {});
      this.markShortcutUsed();
      return;
    }

    if (mod && e.shiftKey && e.key === "A") {
      e.preventDefault();
      this.sendMessage({ type: "abort", payload: {}, timestamp: Date.now() });
      this.markShortcutUsed();
      return;
    }

    if (!inputFocused && AGENT_KEYS[e.key]) {
      e.preventDefault();
      this.handleAgentKey(e.key);
      this.markShortcutUsed();
    }
  }

  private handleAgentKey(key: string): void {
    const info = AGENT_KEYS[key];

    if (this.highlightedAgent === info.id) {
      this.clearHighlight();
      return;
    }

    this.clearHighlight();
    this.highlightedAgent = info.id;
    this.onHighlight({ agentId: info.id, label: info.label });

    this.highlightTimeout = setTimeout(() => {
      this.clearHighlight();
    }, 10000);
  }

  private markShortcutUsed(): void {
    if (this.hasUsedShortcut) return;
    this.hasUsedShortcut = true;
    localStorage.setItem(HINT_STORAGE_KEY, "true");
    if (this.hintElement) {
      this.hintElement.style.display = "none";
    }
  }

  private createHint(): void {
    if (this.hasUsedShortcut) return;

    const hint = document.createElement("div");
    hint.style.cssText = `
      position: fixed;
      bottom: 4px;
      right: 8px;
      font-family: "Courier New", monospace;
      font-size: 10px;
      color: #555555;
      pointer-events: none;
      z-index: 100;
    `;
    hint.textContent = "Ctrl+K: command  |  1-6: agents  |  Ctrl+D: demo";
    document.body.appendChild(hint);
    this.hintElement = hint;
  }
}
