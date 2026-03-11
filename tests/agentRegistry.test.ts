import { describe, expect, it, vi } from "vitest";
import { DEMO_AGENT_IDS } from "../src/server/demo.js";
import {
  AGENT_BY_ID,
  AGENT_BY_ROLE,
  AGENT_REGISTRY,
  ALL_AGENT_IDS,
  buildTeamDescription,
} from "../src/shared/agentRegistry.js";

vi.mock("pixi.js", () => ({
  Container: class {},
  Graphics: class {},
  Text: class {},
  TextStyle: class {},
}));

// Import after mock so pixi.js doesn't blow up in Node
const { HAIR_STYLE_ROLES } = await import("../src/client/office/AgentSprite.js");

describe("AGENT_REGISTRY", () => {
  it("should define exactly 5 agents", () => {
    expect(AGENT_REGISTRY).toHaveLength(5);
  });

  it("should have unique ids", () => {
    const ids = AGENT_REGISTRY.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should have unique roles", () => {
    const roles = AGENT_REGISTRY.map((a) => a.role);
    expect(new Set(roles).size).toBe(roles.length);
  });

  it("should have unique key bindings", () => {
    const keys = AGENT_REGISTRY.map((a) => a.keyBinding);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("should include all expected roles", () => {
    const roles = AGENT_REGISTRY.map((a) => a.role).sort();
    expect(roles).toEqual(["Reviewer", "Sceptic", "Whip", "devka", "druhá devka"]);
  });

  it("should have valid hex color strings", () => {
    for (const agent of AGENT_REGISTRY) {
      expect(agent.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(agent.shirtColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe("AGENT_BY_ID", () => {
  it("should look up agent by id", () => {
    const whip = AGENT_BY_ID["agent-whip"];
    expect(whip?.role).toBe("Whip");
  });

  it("should return undefined for unknown id", () => {
    const unknown = AGENT_BY_ID["agent-unknown"];
    expect(unknown).toBeUndefined();
  });
});

describe("AGENT_BY_ROLE", () => {
  it("should look up agent by role", () => {
    expect(AGENT_BY_ROLE.Whip?.id).toBe("agent-whip");
  });

  it("should return undefined for unknown role", () => {
    expect(AGENT_BY_ROLE.Unknown).toBeUndefined();
  });
});

describe("buildTeamDescription", () => {
  it("should not include the Whip role", () => {
    const desc = buildTeamDescription();
    expect(desc).not.toContain("Whip");
  });

  it("should list all non-Whip roles with their specialties", () => {
    const desc = buildTeamDescription();
    expect(desc).toContain("devka");
    expect(desc).toContain("druhá devka");
    expect(desc).toContain("Reviewer");
    expect(desc).toContain("Sceptic");
    expect(desc).not.toContain("Architect");
  });

  it("should format as dash-prefixed lines", () => {
    const lines = buildTeamDescription().split("\n");
    for (const line of lines) {
      expect(line).toMatch(/^- \w/);
    }
  });
});

describe("Agent registry propagation", () => {
  const registryRoles = AGENT_REGISTRY.map((a) => a.role).sort();

  it("every AGENT_REGISTRY role should have a HAIR_STYLES entry", () => {
    for (const role of registryRoles) {
      expect(HAIR_STYLE_ROLES, `Missing HAIR_STYLES entry for role "${role}"`).toContain(role);
    }
  });

  it("HAIR_STYLES should not contain stale roles", () => {
    for (const role of HAIR_STYLE_ROLES) {
      expect(registryRoles, `Stale HAIR_STYLES entry for role "${role}"`).toContain(role);
    }
  });

  it("every DEMO_STEPS agentId should be a valid agent", () => {
    for (const id of DEMO_AGENT_IDS) {
      expect(ALL_AGENT_IDS, `Invalid DEMO_STEPS agentId "${id}"`).toContain(id);
    }
  });

  it("DEFAULT_AGENTS IDs should match ALL_AGENT_IDS", async () => {
    const { DEFAULT_AGENTS } = await import("../src/server/state.js");
    const defaultIds = DEFAULT_AGENTS.map((a: { id: string }) => a.id).sort();
    const registryIds = [...ALL_AGENT_IDS].sort();
    expect(defaultIds).toEqual(registryIds);
  });
});
