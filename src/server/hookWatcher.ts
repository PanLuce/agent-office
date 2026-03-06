import { createReadStream, existsSync, statSync, watch, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import type { AgentStatus } from "../shared/types.js";

const HOOK_FILE = "./data/hook-events.jsonl";

interface HookEvent {
  tool?: string;
  file?: string;
  event?: string;
  timestamp: number;
}

type OnHookEvent = (event: {
  tool: string;
  file: string;
  status: AgentStatus;
  fileAction: "edit" | "create" | null;
}) => void;

let watcher: ReturnType<typeof watch> | null = null;
let fileOffset = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastEvent: Parameters<OnHookEvent>[0] | null = null;

function ensureFile(): void {
  if (!existsSync(HOOK_FILE)) {
    writeFileSync(HOOK_FILE, "", "utf-8");
  }
  fileOffset = statSync(HOOK_FILE).size;
}

function toolToStatus(tool: string): AgentStatus {
  switch (tool) {
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

function toolToFileAction(tool: string): "edit" | "create" | null {
  switch (tool) {
    case "Write":
      return "create";
    case "Edit":
    case "MultiEdit":
      return "edit";
    default:
      return null;
  }
}

async function readNewLines(callback: OnHookEvent): Promise<void> {
  const currentSize = statSync(HOOK_FILE).size;
  if (currentSize <= fileOffset) return;

  const stream = createReadStream(HOOK_FILE, {
    start: fileOffset,
    encoding: "utf-8",
  });

  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const event: HookEvent = JSON.parse(line);
      if (event.tool) {
        const mapped = {
          tool: event.tool,
          file: event.file ?? "",
          status: toolToStatus(event.tool),
          fileAction: toolToFileAction(event.tool),
        };

        lastEvent = mapped;

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (lastEvent) {
            callback(lastEvent);
            lastEvent = null;
          }
        }, 200);
      }
    } catch {
      // skip malformed lines
    }
  }

  fileOffset = currentSize;
}

export function startWatching(onEvent: OnHookEvent): void {
  ensureFile();

  watcher = watch(HOOK_FILE, () => {
    readNewLines(onEvent).catch(() => {});
  });

  console.log("[hookWatcher] Watching", HOOK_FILE);
}

export function stopWatching(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
