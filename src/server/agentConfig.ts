import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_BY_ID, buildTeamDescription } from "../shared/agentRegistry.js";
import { getToolsForRole } from "./agentManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CONFIG_DIR = path.resolve(__dirname, "../../../config/agents");

export interface AgentConfig {
  allowedTools?: string[];
  systemPrompt?: string;
}

export function loadAgentConfig(agentId: string, configDir = DEFAULT_CONFIG_DIR): AgentConfig {
  const slug = AGENT_BY_ID[agentId]?.configSlug;
  if (!slug) return {};

  const filePath = path.join(configDir, `${slug}.json`);
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as AgentConfig;
  } catch {
    return {};
  }
}

export function resolveAllowedTools(agentId: string, role: string, configDir = DEFAULT_CONFIG_DIR): string[] {
  const config = loadAgentConfig(agentId, configDir);
  if (config.allowedTools && config.allowedTools.length > 0) {
    return config.allowedTools;
  }
  return getToolsForRole(role);
}

export function resolveSystemPrompt(agentId: string, role: string, configDir = DEFAULT_CONFIG_DIR): string | undefined {
  const config = loadAgentConfig(agentId, configDir);
  if (!config.systemPrompt) return undefined;
  return config.systemPrompt.replace("{{team}}", buildTeamDescription());
}
