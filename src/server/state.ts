import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { Agent, AgentEvent, Task } from "../shared/types.js";

const DB_PATH = process.env.AGENT_OFFICE_DB_PATH || "./data/agent-office.db";

mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    current_task TEXT,
    talking_to TEXT,
    position_x REAL NOT NULL,
    position_y REAL NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    assigned_to TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    detail TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );
`);

// Migrate: add talking_to column if missing
try {
  db.exec("ALTER TABLE agents ADD COLUMN talking_to TEXT");
} catch {
  // column already exists
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
`);

function pruneOldEvents(): void {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const result = db.prepare("DELETE FROM events WHERE timestamp < ?").run(cutoff);
  if (result.changes > 0) {
    console.log(`Pruned ${result.changes} old events`);
  }
}

pruneOldEvents();

const DEFAULT_AGENTS: Agent[] = [
  {
    id: "agent-whip",
    name: "Alice",
    role: "Whip",
    status: "idle",
    currentTask: null,
    talkingTo: null,
    positionX: 90,
    positionY: 104,
  },
  {
    id: "agent-architect",
    name: "Bob",
    role: "Architect",
    status: "idle",
    currentTask: null,
    talkingTo: null,
    positionX: 240,
    positionY: 99,
  },
  {
    id: "agent-dev1",
    name: "Carol",
    role: "Dev-1",
    status: "idle",
    currentTask: null,
    talkingTo: null,
    positionX: 385,
    positionY: 106,
  },
  {
    id: "agent-dev2",
    name: "Dave",
    role: "Dev-2",
    status: "idle",
    currentTask: null,
    talkingTo: null,
    positionX: 95,
    positionY: 219,
  },
  {
    id: "agent-tester",
    name: "Eve",
    role: "Tester",
    status: "idle",
    currentTask: null,
    talkingTo: null,
    positionX: 238,
    positionY: 224,
  },
  {
    id: "agent-devops",
    name: "Frank",
    role: "DevOps",
    status: "idle",
    currentTask: null,
    talkingTo: null,
    positionX: 380,
    positionY: 216,
  },
];

function seedAgents(): void {
  const count = db.prepare("SELECT COUNT(*) as cnt FROM agents").get() as { cnt: number };
  if (count.cnt > 0) return;

  const insert = db.prepare(`
    INSERT INTO agents (id, name, role, status, current_task, talking_to, position_x, position_y, updated_at)
    VALUES (@id, @name, @role, @status, @currentTask, @talkingTo, @positionX, @positionY, @updatedAt)
  `);

  const now = Date.now();
  const seedAll = db.transaction(() => {
    for (const agent of DEFAULT_AGENTS) {
      insert.run({ ...agent, updatedAt: now });
    }
  });
  seedAll();
}

seedAgents();

interface AgentRow {
  id: string;
  name: string;
  role: string;
  status: string;
  current_task: string | null;
  talking_to: string | null;
  position_x: number;
  position_y: number;
  updated_at: number;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  assigned_to: string | null;
  created_at: number;
  updated_at: number;
}

interface EventRow {
  id: number;
  agent_id: string;
  event_type: string;
  detail: string;
  timestamp: number;
}

function rowToAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    status: row.status as Agent["status"],
    currentTask: row.current_task,
    talkingTo: row.talking_to,
    positionX: row.position_x,
    positionY: row.position_y,
  };
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    status: row.status as Task["status"],
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToEvent(row: EventRow): AgentEvent {
  return {
    id: row.id,
    agentId: row.agent_id,
    eventType: row.event_type,
    detail: row.detail,
    timestamp: row.timestamp,
  };
}

export function getAgents(): Agent[] {
  const rows = db.prepare("SELECT * FROM agents").all() as AgentRow[];
  return rows.map(rowToAgent);
}

export function getAgent(id: string): Agent | undefined {
  const row = db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as AgentRow | undefined;
  return row ? rowToAgent(row) : undefined;
}

export function upsertAgent(agent: Agent): void {
  db.prepare(`
    INSERT INTO agents (id, name, role, status, current_task, talking_to, position_x, position_y, updated_at)
    VALUES (@id, @name, @role, @status, @currentTask, @talkingTo, @positionX, @positionY, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      name = @name, role = @role, status = @status, current_task = @currentTask,
      talking_to = @talkingTo, position_x = @positionX, position_y = @positionY, updated_at = @updatedAt
  `).run({ ...agent, updatedAt: Date.now() });
}

export function getTasks(): Task[] {
  const rows = db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all() as TaskRow[];
  return rows.map(rowToTask);
}

export function upsertTask(task: Task): void {
  db.prepare(`
    INSERT INTO tasks (id, title, status, assigned_to, created_at, updated_at)
    VALUES (@id, @title, @status, @assignedTo, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      title = @title, status = @status, assigned_to = @assignedTo, updated_at = @updatedAt
  `).run({ ...task });
}

export function addEvent(event: Omit<AgentEvent, "id">): void {
  db.prepare(`
    INSERT INTO events (agent_id, event_type, detail, timestamp)
    VALUES (@agentId, @eventType, @detail, @timestamp)
  `).run({ ...event });
}

export function getRecentEvents(limit = 50): AgentEvent[] {
  const rows = db.prepare("SELECT * FROM events ORDER BY timestamp DESC LIMIT ?").all(limit) as EventRow[];
  return rows.map(rowToEvent);
}

export function createTask(title: string, assignedTo?: string): Task {
  const now = Date.now();
  const task: Task = {
    id: randomUUID(),
    title,
    status: "pending",
    assignedTo: assignedTo ?? null,
    createdAt: now,
    updatedAt: now,
  };
  upsertTask(task);
  return task;
}

export function assignTask(taskId: string, agentId: string): void {
  db.prepare("UPDATE tasks SET assigned_to = ?, status = 'in_progress', updated_at = ? WHERE id = ?").run(
    agentId,
    Date.now(),
    taskId,
  );
}

export function completeTask(taskId: string, success: boolean): void {
  const status = success ? "done" : "failed";
  db.prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?").run(status, Date.now(), taskId);
}

export function getActiveTasks(): Task[] {
  const rows = db
    .prepare("SELECT * FROM tasks WHERE status IN ('pending', 'in_progress') ORDER BY created_at DESC")
    .all() as TaskRow[];
  return rows.map(rowToTask);
}

export function getPendingTasks(): Task[] {
  const rows = db.prepare("SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at DESC").all() as TaskRow[];
  return rows.map(rowToTask);
}

export function clearTasks(): void {
  db.prepare("DELETE FROM tasks").run();
}
