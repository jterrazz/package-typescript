import { execSync } from "child_process";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const ROOT_DIR = resolve(import.meta.dirname, "..");
const RUNNER_BIN = resolve(ROOT_DIR, "bin/typescript.sh");

function runRunner(args: string = ""): { success: boolean; output: string } {
  try {
    const output = execSync(`${RUNNER_BIN} ${args}`, {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, output };
  } catch (error: any) {
    const output = error.stdout?.toString() || error.stderr?.toString() || "";
    return { success: false, output };
  }
}

describe("cli integration", () => {
  it("should show help when no command is provided", () => {
    const result = runRunner();
    expect(result.output).toContain("TYPESCRIPT");
    expect(result.output).toContain("Usage: typescript <command>");
    expect(result.output).toContain("build");
    expect(result.output).toContain("watch");
  });

  it("should show help with unknown command", () => {
    const result = runRunner("unknown");
    expect(result.output).toContain("Usage: typescript <command>");
  });

  it("should show build mode options in help", () => {
    const result = runRunner();
    expect(result.output).toContain("build app");
    expect(result.output).toContain("build lib");
  });

  it("should show examples in help", () => {
    const result = runRunner();
    expect(result.output).toContain("typescript build lib");
    expect(result.output).toContain("typescript watch");
  });
});
