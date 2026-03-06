import { describe, expect, it } from "vitest";
import { isAbortError, mapToolToFileAction, mapToolToStatus } from "../src/server/agentManager.js";

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
