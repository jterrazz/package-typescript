import { execSync } from "child_process";
import { cpSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT_DIR = resolve(import.meta.dirname, "../../..");
const SAMPLE_DIR = resolve(import.meta.dirname, "../../fixtures/sample-app");
const RUNNER_BIN = resolve(ROOT_DIR, "bin/typescript.sh");

function runCommand(projectDir: string, command: string) {
  try {
    const output = execSync(`${RUNNER_BIN} ${command}`, {
      cwd: projectDir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, INIT_CWD: undefined },
    });
    return { success: true, output };
  } catch (error: any) {
    const output = error.stdout?.toString() || error.stderr?.toString() || "";
    return { success: false, output };
  }
}

describe("start integration", () => {
  let tempDir: string;
  let appDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), "runner-start-test-"));
    cpSync(SAMPLE_DIR, resolve(tempDir, "sample-app"), { recursive: true });
    appDir = resolve(tempDir, "sample-app");

    // Build first so dist/index.js exists
    runCommand(appDir, "build");
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should run the built application", () => {
    const result = runCommand(appDir, "start");
    expect(result.success).toBe(true);
    expect(result.output).toContain("Hello from sample app");
  });

  it("should fail if dist does not exist", () => {
    const emptyDir = mkdtempSync(resolve(tmpdir(), "runner-start-empty-"));
    const result = runCommand(emptyDir, "start");
    expect(result.success).toBe(false);
    rmSync(emptyDir, { recursive: true, force: true });
  });
});
