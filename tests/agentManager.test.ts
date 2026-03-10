import { describe, expect, it } from "vitest";
import { buildClaudeArgs, isAbortError, mapToolToFileAction, mapToolToStatus } from "../src/server/agentManager.js";

describe("mapToolToStatus", () => {
  it("should map Read to reviewing", () => {
    expect(mapToolToStatus("Read")).toBe("reviewing");
  });

  it("should map Glob to reviewing", () => {
    expect(mapToolToStatus("Glob")).toBe("reviewing");
  });

  it("should map Grep to reviewing", () => {
    expect(mapToolToStatus("Grep")).toBe("reviewing");
  });

  it("should map Write to coding", () => {
    expect(mapToolToStatus("Write")).toBe("coding");
  });

  it("should map Edit to coding", () => {
    expect(mapToolToStatus("Edit")).toBe("coding");
  });

  it("should map MultiEdit to coding", () => {
    expect(mapToolToStatus("MultiEdit")).toBe("coding");
  });

  it("should map Bash to coding", () => {
    expect(mapToolToStatus("Bash")).toBe("coding");
  });

  it("should map unknown tools to thinking", () => {
    expect(mapToolToStatus("SomeNewTool")).toBe("thinking");
  });
});

describe("mapToolToFileAction", () => {
  it("should map Write to create", () => {
    expect(mapToolToFileAction("Write")).toBe("create");
  });

  it("should map Edit to edit", () => {
    expect(mapToolToFileAction("Edit")).toBe("edit");
  });

  it("should map MultiEdit to edit", () => {
    expect(mapToolToFileAction("MultiEdit")).toBe("edit");
  });

  it("should return null for non-file tools", () => {
    expect(mapToolToFileAction("Read")).toBeNull();
    expect(mapToolToFileAction("Bash")).toBeNull();
    expect(mapToolToFileAction("Grep")).toBeNull();
  });
});

describe("buildClaudeArgs", () => {
  it("should not include prompt in args when allowedTools are present", () => {
    const result = buildClaudeArgs({
      systemPrompt: "You are helpful",
      allowedTools: ["Read", "Write"],
    });

    expect(result.args).not.toContain("some prompt text");
    expect(result.args).toContain("--allowedTools");
    expect(result.args).toContain("Read");
    expect(result.args).toContain("Write");
    expect(result.useStdin).toBe(true);
  });

  it("should include base flags", () => {
    const result = buildClaudeArgs({});

    expect(result.args).toContain("--print");
    expect(result.args).toContain("--output-format");
    expect(result.args).toContain("stream-json");
    expect(result.args).toContain("--verbose");
    expect(result.args).toContain("--max-turns");
    expect(result.args).toContain("30");
  });

  it("should include system prompt when provided", () => {
    const result = buildClaudeArgs({ systemPrompt: "Be concise" });

    expect(result.args).toContain("--system-prompt");
    expect(result.args).toContain("Be concise");
  });

  it("should not include system prompt flag when not provided", () => {
    const result = buildClaudeArgs({});

    expect(result.args).not.toContain("--system-prompt");
  });

  it("should not include allowedTools flag when no tools provided", () => {
    const result = buildClaudeArgs({});

    expect(result.args).not.toContain("--allowedTools");
  });
});

describe("isAbortError", () => {
  it("should detect aborted keyword", () => {
    expect(isAbortError("process was aborted")).toBe(true);
  });

  it("should detect SIGTERM keyword", () => {
    expect(isAbortError("killed by SIGTERM")).toBe(true);
  });

  it("should detect exit code 143", () => {
    expect(isAbortError("claude exited with code 143")).toBe(true);
  });

  it("should not match generic errors", () => {
    expect(isAbortError("claude exited with code 1")).toBe(false);
    expect(isAbortError("network timeout")).toBe(false);
  });
});
