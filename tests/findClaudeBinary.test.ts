import { spawnSync } from "node:child_process";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { expandTilde, findClaudeBinary, validateWorkingDirectory } from "../src/server/agentManager.js";

describe("findClaudeBinary", () => {
  it("should return a non-empty string", () => {
    const result = findClaudeBinary();
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("should return a path that contains 'claude'", () => {
    const result = findClaudeBinary();
    expect(result).toContain("claude");
  });

  it("should find the local node_modules binary when it exists", () => {
    const result = findClaudeBinary();
    expect(result).toMatch(/node_modules.*claude|\/claude$/);
  });

  it("should return an absolute path when local binary exists", () => {
    const result = findClaudeBinary();
    if (result !== "claude") {
      expect(result.startsWith("/")).toBe(true);
    }
  });

  it("should be directly spawnable with --version", () => {
    const claudePath = findClaudeBinary();
    const result = spawnSync(claudePath, ["--version"], {
      timeout: 5000,
      encoding: "utf-8",
      env: { ...process.env, CLAUDECODE: undefined },
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Claude Code");
  });
});

describe("validateWorkingDirectory", () => {
  it("should accept an existing directory", () => {
    expect(() => validateWorkingDirectory("/tmp")).not.toThrow();
  });

  it("should throw for a non-existent directory", () => {
    expect(() => validateWorkingDirectory("/nonexistent/path/to/nowhere")).toThrow(/does not exist/);
  });

  it("should throw for a file path instead of directory", () => {
    expect(() => validateWorkingDirectory("/etc/hosts")).toThrow(/not a directory/);
  });

  it("should throw for null or empty", () => {
    expect(() => validateWorkingDirectory(null as unknown as string)).toThrow();
    expect(() => validateWorkingDirectory("")).toThrow();
  });

  it("should not cause ENOENT when used as spawn cwd", () => {
    const claudePath = findClaudeBinary();
    const cwd = "/tmp";
    validateWorkingDirectory(cwd);

    const result = spawnSync(process.execPath, [claudePath, "--version"], {
      cwd,
      timeout: 5000,
      encoding: "utf-8",
      env: { ...process.env, CLAUDECODE: undefined },
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
  });
});

describe("expandTilde", () => {
  const home = os.homedir();

  it("should expand ~ at the start to home directory", () => {
    expect(expandTilde("~/projects")).toBe(`${home}/projects`);
  });

  it("should expand bare ~ to home directory", () => {
    expect(expandTilde("~")).toBe(home);
  });

  it("should not modify absolute paths", () => {
    expect(expandTilde("/usr/local")).toBe("/usr/local");
  });

  it("should not modify relative paths without tilde", () => {
    expect(expandTilde("foo/bar")).toBe("foo/bar");
  });

  it("should not expand tilde in the middle of a path", () => {
    expect(expandTilde("/some/~/path")).toBe("/some/~/path");
  });
});
