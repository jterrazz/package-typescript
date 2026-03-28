import { spawn } from "child_process";
import { cpSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT_DIR = resolve(import.meta.dirname, "../..");
const FIXTURES_DIR = resolve(ROOT_DIR, "tests/fixtures");
const RUNNER_BIN = resolve(ROOT_DIR, "bin/typescript.sh");

function runDevMode(
  projectDir: string,
  timeoutMs: number = 5000,
  resolveOnMatch?: string,
): Promise<{ output: string; didRun: boolean }> {
  return new Promise((resolvePromise) => {
    let output = "";
    let didRun = false;
    let resolved = false;

    const child = spawn(RUNNER_BIN, ["dev"], {
      cwd: projectDir,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, INIT_CWD: undefined },
    });

    const finish = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      child.kill("SIGTERM");
      resolvePromise({ output, didRun });
    };

    child.stdout?.on("data", (data) => {
      output += data.toString();
      if (output.includes("Build complete") || output.includes("Hello from sample app")) {
        didRun = true;
      }
      if (resolveOnMatch && output.includes(resolveOnMatch)) {
        finish();
      }
    });

    child.stderr?.on("data", (data) => {
      output += data.toString();
    });

    setTimeout(finish, timeoutMs);
  });
}

describe("dev integration", () => {
  let tempDir: string;
  let appDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), "runner-dev-test-"));
    cpSync(FIXTURES_DIR, tempDir, { recursive: true });
    appDir = resolve(tempDir, "sample-app");
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should start dev mode and show startup message", async () => {
    const { output } = await runDevMode(appDir, 5000, "Starting dev mode");
    expect(output).toContain("TYPESCRIPT");
    expect(output).toContain("Starting dev mode");
  });

  it("should build and run the app", async () => {
    const { output, didRun } = await runDevMode(appDir, 15_000, "Hello from sample app");
    expect(didRun).toBe(true);
    expect(output).toContain("Hello from sample app");
  });
});
