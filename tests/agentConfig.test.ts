import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadAgentConfig, resolveAllowedTools, resolveSystemPrompt } from "../src/server/agentConfig.js";
import { AGENT_REGISTRY, buildTeamDescription } from "../src/shared/agentRegistry.js";

describe("loadAgentConfig", () => {
  let configDir: string;

  beforeEach(() => {
    configDir = mkdtempSync(path.join(tmpdir(), "agent-config-test-"));
  });

  afterEach(() => {
    rmSync(configDir, { recursive: true, force: true });
  });

  it("should load allowedTools from a valid config file", () => {
    const config = { allowedTools: ["Read", "Write", "Bash"] };
    writeFileSync(path.join(configDir, "dev-1.json"), JSON.stringify(config));

    const result = loadAgentConfig("agent-dev1", configDir);

    expect(result.allowedTools).toEqual(["Read", "Write", "Bash"]);
  });

  it("should return empty config when file does not exist", () => {
    const result = loadAgentConfig("agent-dev1", configDir);

    expect(result).toEqual({});
  });

  it("should return empty config when file contains invalid JSON", () => {
    writeFileSync(path.join(configDir, "dev-1.json"), "not json {{{");

    const result = loadAgentConfig("agent-dev1", configDir);

    expect(result).toEqual({});
  });

  it("should return config without allowedTools when key is missing", () => {
    writeFileSync(path.join(configDir, "dev-1.json"), JSON.stringify({ other: "value" }));

    const result = loadAgentConfig("agent-dev1", configDir);

    expect(result.allowedTools).toBeUndefined();
  });

  it("should load systemPrompt from config file", () => {
    const config = { allowedTools: ["Read"], systemPrompt: "You are the Sceptic." };
    writeFileSync(path.join(configDir, "sceptic.json"), JSON.stringify(config));

    const result = loadAgentConfig("agent-sceptic", configDir);

    expect(result.systemPrompt).toBe("You are the Sceptic.");
  });

  it("should map each agent ID to the correct config filename", () => {
    for (const def of AGENT_REGISTRY) {
      const config = { allowedTools: ["Read"] };
      writeFileSync(path.join(configDir, `${def.configSlug}.json`), JSON.stringify(config));

      const result = loadAgentConfig(def.id, configDir);
      expect(result.allowedTools).toEqual(["Read"]);
    }
  });
});

describe("resolveAllowedTools", () => {
  let configDir: string;

  beforeEach(() => {
    configDir = mkdtempSync(path.join(tmpdir(), "agent-config-test-"));
  });

  afterEach(() => {
    rmSync(configDir, { recursive: true, force: true });
  });

  it("should use config file tools when present", () => {
    const config = { allowedTools: ["Read", "Bash"] };
    writeFileSync(path.join(configDir, "dev-1.json"), JSON.stringify(config));

    const tools = resolveAllowedTools("agent-dev1", "Dev-1", configDir);

    expect(tools).toEqual(["Read", "Bash"]);
  });

  it("should fall back to role defaults when no config file exists", () => {
    const tools = resolveAllowedTools("agent-dev1", "Dev-1", configDir);

    expect(tools).toEqual(["Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep"]);
  });

  it("should fall back to role defaults when config has no allowedTools", () => {
    writeFileSync(path.join(configDir, "dev-1.json"), JSON.stringify({ other: true }));

    const tools = resolveAllowedTools("agent-dev1", "Dev-1", configDir);

    expect(tools).toEqual(["Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep"]);
  });

  it("should return minimal defaults for unknown roles without config", () => {
    const tools = resolveAllowedTools("agent-unknown", "Unknown", configDir);

    expect(tools).toEqual(["Read", "Glob", "Grep"]);
  });
});

describe("resolveSystemPrompt", () => {
  let configDir: string;

  beforeEach(() => {
    configDir = mkdtempSync(path.join(tmpdir(), "agent-config-test-"));
  });

  afterEach(() => {
    rmSync(configDir, { recursive: true, force: true });
  });

  it("should return systemPrompt from config when present", () => {
    const config = { allowedTools: ["Read"], systemPrompt: "You question everything." };
    writeFileSync(path.join(configDir, "sceptic.json"), JSON.stringify(config));

    const result = resolveSystemPrompt("agent-sceptic", "Sceptic", configDir);

    expect(result).toBe("You question everything.");
  });

  it("should return undefined when config has no systemPrompt", () => {
    const config = { allowedTools: ["Read"] };
    writeFileSync(path.join(configDir, "sceptic.json"), JSON.stringify(config));

    const result = resolveSystemPrompt("agent-sceptic", "Sceptic", configDir);

    expect(result).toBeUndefined();
  });

  it("should return undefined when no config file exists", () => {
    const result = resolveSystemPrompt("agent-sceptic", "Sceptic", configDir);

    expect(result).toBeUndefined();
  });

  it("should expand {{team}} placeholder with team description", () => {
    const config = { systemPrompt: "Your team:\n{{team}}\n\nDelegate work." };
    writeFileSync(path.join(configDir, "whip.json"), JSON.stringify(config));

    const result = resolveSystemPrompt("agent-whip", "Whip", configDir);

    expect(result).toContain(buildTeamDescription());
    expect(result).not.toContain("{{team}}");
  });
});
