import type { WSMessage } from "../../shared/types.js";

const MAX_HISTORY = 50;
const STORAGE_KEY = "agent-office-working-dir";

type SendFn = (message: WSMessage) => void;
type CommandCallback = (text: string) => void;

export class CommandBar {
  private input: HTMLInputElement;
  private indicator: HTMLSpanElement;
  private abortBtn: HTMLButtonElement;
  private history: string[] = [];
  private historyIndex = -1;
  private sendMessage: SendFn;
  private onCommand: CommandCallback;
  private processing = false;
  private connected = false;

  constructor(sendMessage: SendFn, onCommand: CommandCallback) {
    this.sendMessage = sendMessage;
    this.onCommand = onCommand;

    this.input = document.getElementById("command-input") as HTMLInputElement;
    this.indicator = document.getElementById("prompt-indicator") as HTMLSpanElement;
    this.abortBtn = document.getElementById("abort-btn") as HTMLButtonElement;

    this.input.addEventListener("keydown", (e) => this.handleKeyDown(e));
    this.abortBtn.addEventListener("click", () => this.sendAbort());

    this.updatePlaceholder();
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
    this.updatePlaceholder();
  }

  setProcessing(active: boolean): void {
    this.processing = active;
    this.input.disabled = active;
    this.abortBtn.style.display = active ? "inline-block" : "none";

    if (active) {
      this.input.placeholder = "⏳ Processing...";
      this.indicator.style.color = "#f39c12";
    } else {
      this.updatePlaceholder();
      this.indicator.style.color = this.connected ? "#2ecc71" : "#888888";
      this.input.focus();
    }
  }

  getStoredWorkingDirectory(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  }

  autoConnect(): void {
    const stored = this.getStoredWorkingDirectory();
    if (stored) {
      this.sendStartMessage(stored);
    }
  }

  handleStartAck(directory: string): void {
    localStorage.setItem(STORAGE_KEY, directory);
    this.connected = true;
    this.updatePlaceholder();
    this.indicator.style.color = "#2ecc71";
  }

  private updatePlaceholder(): void {
    if (!this.processing) {
      this.input.placeholder = this.connected
        ? "Type instructions for the team..."
        : "Enter project path to connect (e.g., /Users/you/project)...";
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      this.submit();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      this.navigateHistory(1);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.navigateHistory(-1);
    }
  }

  private submit(): void {
    const text = this.input.value.trim();
    if (!text || this.processing) return;

    this.pushHistory(text);
    this.input.value = "";

    if (!this.connected) {
      this.sendStartMessage(text);
      return;
    }

    this.onCommand(text);

    this.sendMessage({
      type: "command",
      payload: { text },
      timestamp: Date.now(),
    });

    this.setProcessing(true);
  }

  private sendStartMessage(directory: string): void {
    this.sendMessage({
      type: "start",
      payload: { workingDirectory: directory },
      timestamp: Date.now(),
    });
  }

  private sendAbort(): void {
    this.sendMessage({
      type: "abort",
      payload: {},
      timestamp: Date.now(),
    });
  }

  private pushHistory(text: string): void {
    if (this.history[0] === text) return;
    this.history.unshift(text);
    if (this.history.length > MAX_HISTORY) {
      this.history.pop();
    }
    this.historyIndex = -1;
  }

  private navigateHistory(direction: number): void {
    const next = this.historyIndex + direction;
    if (next < -1 || next >= this.history.length) return;

    this.historyIndex = next;
    this.input.value = next === -1 ? "" : this.history[next];

    setTimeout(() => {
      this.input.selectionStart = this.input.value.length;
      this.input.selectionEnd = this.input.value.length;
    }, 0);
  }
}
