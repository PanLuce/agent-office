import { type ChildProcess, execSync, spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_BY_ROLE } from "../shared/agentRegistry.js";
import type { AgentStatus } from "../shared/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { resolveAllowedTools, resolveSystemPrompt } from "./agentConfig.js";
import { assignTask, completeTask, createTask, getActiveTasks, getAgent } from "./state.js";

export function mapToolToStatus(toolName: string): AgentStatus {
  switch (toolName) {
    case "Read":
    case "Glob":
    case "Grep":
      return "reviewing";
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "Bash":
      return "coding";
    default:
      return "thinking";
  }
}

export function mapToolToFileAction(toolName: string): "edit" | "create" | null {
  switch (toolName) {
    case "Write":
      return "create";
    case "Edit":
    case "MultiEdit":
      return "edit";
    default:
      return null;
  }
}

export function isAbortError(message: string): boolean {
  return message.includes("aborted") || message.includes("SIGTERM") || message.includes("code 143");
}

export interface ParsedTaskAssignment {
  assign: string;
  task: string;
}

export function parseTaskAssignments(text: string): ParsedTaskAssignment[] {
  const results: ParsedTaskAssignment[] = [];
  const regex = /```task\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null = regex.exec(text);

  while (match !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.assign && parsed.task) {
        results.push({ assign: parsed.assign, task: parsed.task });
      }
    } catch {
      console.warn("[parseTaskAssignments] Skipping malformed task block");
    }
    match = regex.exec(text);
  }

  return results;
}

export function expandTilde(filePath: string): string {
  if (filePath === "~") return os.homedir();
  if (filePath.startsWith("~/")) return path.join(os.homedir(), filePath.slice(2));
  return filePath;
}

export function validateWorkingDirectory(dir: string): void {
  if (!dir) {
    throw new Error("Working directory is not set");
  }
  if (!existsSync(dir)) {
    throw new Error(`Working directory does not exist: ${dir}`);
  }
  if (!statSync(dir).isDirectory()) {
    throw new Error(`Working directory path is not a directory: ${dir}`);
  }
}

export function findClaudeBinary(): string {
  // 1. Project-local: node_modules/.bin/claude relative to project root
  const projectRoot = path.resolve(__dirname, "../../..");
  const localBin = path.join(projectRoot, "node_modules", ".bin", "claude");
  if (existsSync(localBin)) {
    return localBin;
  }

  // 2. Global: find claude on PATH
  try {
    const globalPath = execSync("which claude", { encoding: "utf-8" }).trim();
    if (globalPath && existsSync(globalPath)) {
      return globalPath;
    }
  } catch {
    // not on PATH
  }

  // 3. Fallback: assume it's on PATH and let spawn resolve it
  return "claude";
}

interface ClaudeArgsOptions {
  systemPrompt?: string;
  allowedTools?: string[];
}

interface ClaudeArgsResult {
  args: string[];
  useStdin: boolean;
}

export function buildClaudeArgs(options: ClaudeArgsOptions): ClaudeArgsResult {
  const args = ["--print", "--output-format", "stream-json", "--verbose", "--max-turns", "30"];

  if (options.systemPrompt) {
    args.push("--system-prompt", options.systemPrompt);
  }

  if (options.allowedTools && options.allowedTools.length > 0) {
    args.push("--allowedTools", ...options.allowedTools);
  }

  return { args, useStdin: true };
}

export function resolveAgentId(agentName: string): string | null {
  return AGENT_BY_ROLE[agentName]?.id ?? null;
}

export function getToolsForRole(role: string): string[] {
  return AGENT_BY_ROLE[role]?.defaultTools ?? ["Read", "Glob", "Grep"];
}

type StatusCallback = (agentId: string, status: AgentStatus, talkingTo?: string | null) => void;
type EventCallback = (agentId: string, eventType: string, detail: string) => void;
type FileChangeCallback = (filePath: string, action: "edit" | "create" | "delete", agentId?: string) => void;
type TaskChangeCallback = () => void;

interface AgentManagerCallbacks {
  onStatusChange: StatusCallback;
  onEvent: EventCallback;
  onFileChange: FileChangeCallback;
  onTaskChange?: TaskChangeCallback;
}

export class AgentManager {
  private workingDirectory: string | null = null;
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private busy: Map<string, boolean> = new Map();
  private callbacks: AgentManagerCallbacks;
  private teammatePromises: Set<Promise<void>> = new Set();

  constructor(callbacks: AgentManagerCallbacks) {
    this.callbacks = callbacks;
  }

  setWorkingDirectory(dir: string): void {
    this.workingDirectory = path.resolve(expandTilde(dir));
  }

  getWorkingDirectory(): string | null {
    return this.workingDirectory;
  }

  isAgentBusy(agentId: string): boolean {
    return this.busy.get(agentId) ?? false;
  }

  getStatus(): { workingDirectory: string | null; busy: Record<string, boolean> } {
    const busyMap: Record<string, boolean> = {};
    for (const [id, val] of this.busy) {
      busyMap[id] = val;
    }
    return { workingDirectory: this.workingDirectory, busy: busyMap };
  }

  async processCommand(text: string): Promise<void> {
    if (!this.workingDirectory) return;

    const agentId = "agent-whip";
    if (this.busy.get(agentId)) {
      this.callbacks.onEvent(agentId, "warning", "Whip is already busy, please wait.");
      return;
    }

    this.busy.set(agentId, true);
    this.callbacks.onStatusChange(agentId, "thinking");
    this.callbacks.onEvent(agentId, "status", `Analyzing: "${text}"`);

    try {
      const whipTools = resolveAllowedTools(agentId, "Whip");
      const whipSystemPrompt = resolveSystemPrompt(agentId);
      const assistantText = await this.runClaude(agentId, text, whipSystemPrompt, whipTools);
      await this.delegateFromWhipOutput(assistantText);

      if (this.teammatePromises.size > 0) {
        this.callbacks.onEvent(agentId, "status", `Waiting for ${this.teammatePromises.size} teammate(s)...`);
        await Promise.allSettled(this.teammatePromises);
        this.teammatePromises.clear();
        this.callbacks.onEvent(agentId, "completed", "All tasks completed.");
      } else {
        this.callbacks.onEvent(agentId, "completed", "Task finished.");
      }

      this.callbacks.onStatusChange(agentId, "idle");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      if (isAbortError(message)) {
        this.callbacks.onEvent(agentId, "aborted", "Task was aborted by user.");
      } else {
        this.callbacks.onEvent(agentId, "error", `Error: ${message}`);
      }

      this.callbacks.onStatusChange(agentId, "idle");
    } finally {
      this.busy.delete(agentId);
      this.activeProcesses.delete(agentId);
    }
  }

  private async delegateFromWhipOutput(assistantText: string): Promise<void> {
    const assignments = parseTaskAssignments(assistantText);
    if (assignments.length === 0) return;

    for (let i = 0; i < assignments.length; i++) {
      const assignment = assignments[i];
      if (assignment.assign === "self") continue;

      const agentId = resolveAgentId(assignment.assign);
      if (!agentId) {
        this.callbacks.onEvent("agent-whip", "warning", `Unknown teammate: ${assignment.assign}`);
        continue;
      }

      if (this.busy.get(agentId)) {
        this.callbacks.onEvent("agent-whip", "warning", `${assignment.assign} is already busy, skipping.`);
        continue;
      }

      const agent = getAgent(agentId);
      if (!agent) continue;

      const task = createTask(assignment.task, agentId);
      this.callbacks.onTaskChange?.();

      // Visual: Whip briefly talks to teammate
      this.callbacks.onStatusChange("agent-whip", "talking", agentId);
      this.callbacks.onEvent(
        "agent-whip",
        "delegation",
        `Assigning to ${agent.role}: ${assignment.task.slice(0, 100)}`,
      );

      // Stagger spawns by 1s each
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }

      const promise = this.spawnTeammate(agentId, agent.role, assignment.task, task.id);
      this.teammatePromises.add(promise);
      promise.finally(() => this.teammatePromises.delete(promise));

      // Brief talking animation (1.5s) before next delegation
      await new Promise((r) => setTimeout(r, 1500));
      this.callbacks.onStatusChange("agent-whip", "thinking");
    }
  }

  private async spawnTeammate(agentId: string, role: string, taskDescription: string, taskId: string): Promise<void> {
    const agent = getAgent(agentId);
    if (!agent) return;

    this.busy.set(agentId, true);
    this.callbacks.onStatusChange(agentId, "thinking");
    this.callbacks.onEvent(agentId, "status", `Starting: ${taskDescription.slice(0, 120)}`);
    assignTask(taskId, agentId);
    this.callbacks.onTaskChange?.();

    const tools = resolveAllowedTools(agentId, role);
    const systemPrompt = resolveSystemPrompt(agentId);
    const prompt = systemPrompt
      ? `Complete this task in the project at ${this.workingDirectory}: ${taskDescription}\n\nWork independently. Be thorough but concise. When done, summarize what you did.`
      : `You are the ${role} specialist. Complete this task in the project at ${this.workingDirectory}: ${taskDescription}\n\nWork independently. Be thorough but concise. When done, summarize what you did.`;

    try {
      await this.runClaude(agentId, prompt, systemPrompt, tools);
      completeTask(taskId, true);
      this.callbacks.onTaskChange?.();
      this.callbacks.onStatusChange(agentId, "idle");
      this.callbacks.onEvent(agentId, "completed", `Finished: ${taskDescription.slice(0, 100)}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      completeTask(taskId, false);
      this.callbacks.onTaskChange?.();

      if (isAbortError(message)) {
        this.callbacks.onEvent(agentId, "aborted", "Task was aborted.");
      } else {
        this.callbacks.onEvent(agentId, "error", `Error: ${message}`);
      }

      this.callbacks.onStatusChange(agentId, "idle");
    } finally {
      this.busy.delete(agentId);
      this.activeProcesses.delete(agentId);
    }
  }

  abort(agentId: string): boolean {
    const proc = this.activeProcesses.get(agentId);
    if (proc) {
      proc.kill("SIGTERM");
      this.activeProcesses.delete(agentId);
      return true;
    }
    return false;
  }

  abortAll(): number {
    let count = 0;
    for (const [agentId, proc] of this.activeProcesses) {
      proc.kill("SIGTERM");
      this.busy.delete(agentId);
      count++;
    }
    this.activeProcesses.clear();

    // Fail all active tasks
    const activeTasks = getActiveTasks();
    for (const task of activeTasks) {
      completeTask(task.id, false);
    }

    return count;
  }

  private runClaude(agentId: string, prompt: string, systemPrompt?: string, allowedTools?: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.workingDirectory) {
        reject(new Error("Working directory not set"));
        return;
      }

      try {
        validateWorkingDirectory(this.workingDirectory);
      } catch (err) {
        reject(err);
        return;
      }

      const claudePath = this.findClaudeBinary();
      const workingDir = this.workingDirectory;

      const { args: claudeArgs } = buildClaudeArgs({ systemPrompt, allowedTools });

      const proc = spawn(claudePath, claudeArgs, {
        cwd: workingDir,
        env: {
          ...process.env,
          CLAUDECODE: undefined,
        },
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.activeProcesses.set(agentId, proc);

      let buffer = "";
      let fullText = "";
      let lastStatus: AgentStatus = "thinking";

      proc.stdout?.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const text = this.processStreamLine(agentId, line, lastStatus, (newStatus) => {
            lastStatus = newStatus;
          });
          if (text) fullText += text;
        }
      });

      let stderrOutput = "";
      proc.stderr?.on("data", (chunk: Buffer) => {
        stderrOutput += chunk.toString();
      });

      proc.on("close", (code) => {
        if (buffer.trim()) {
          const text = this.processStreamLine(agentId, buffer, lastStatus, (newStatus) => {
            lastStatus = newStatus;
          });
          if (text) fullText += text;
        }

        if (code === 0 || code === null) {
          resolve(fullText);
        } else {
          reject(new Error(stderrOutput.slice(0, 500) || `claude exited with code ${code}`));
        }
      });

      proc.on("error", (err) => {
        reject(err);
      });

      proc.stdin?.write(prompt);
      proc.stdin?.end();
    });
  }

  private processStreamLine(
    agentId: string,
    line: string,
    currentStatus: AgentStatus,
    setStatus: (s: AgentStatus) => void,
  ): string | null {
    try {
      const msg = JSON.parse(line);

      if (msg.type === "assistant" && msg.message?.content) {
        const content = msg.message.content;
        let extractedText = "";

        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) {
              extractedText += block.text;
              this.callbacks.onEvent(agentId, "thinking", block.text.slice(0, 200));
              if (currentStatus !== "thinking") {
                this.callbacks.onStatusChange(agentId, "thinking");
                setStatus("thinking");
              }
            }

            if (block.type === "tool_use") {
              const toolName: string = block.name ?? "unknown";
              const newStatus = mapToolToStatus(toolName);
              this.callbacks.onStatusChange(agentId, newStatus);
              setStatus(newStatus);
              this.callbacks.onEvent(agentId, "tool", `Using ${toolName}`);

              const input = block.input as Record<string, unknown> | undefined;
              const filePath = input?.file_path ?? input?.path ?? input?.command;
              if (typeof filePath === "string") {
                const action = mapToolToFileAction(toolName);
                if (action) {
                  this.callbacks.onFileChange(filePath.slice(0, 200), action, agentId);
                }
              }
            }
          }
        }

        return extractedText || null;
      }

      if (msg.type === "result") {
        const text = typeof msg.result === "string" ? msg.result : JSON.stringify(msg.result).slice(0, 200);
        this.callbacks.onEvent(agentId, "result", text);
      }
    } catch {
      // Non-JSON line, skip
    }

    return null;
  }

  private findClaudeBinary(): string {
    return findClaudeBinary();
  }
}
