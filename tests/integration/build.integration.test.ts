import { execSync } from "child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT_DIR = resolve(import.meta.dirname, "../..");
const FIXTURES_DIR = resolve(ROOT_DIR, "tests/fixtures");
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

describe("build integration", () => {
  let tempDir: string;
  let appDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), "runner-build-test-"));
    cpSync(FIXTURES_DIR, tempDir, { recursive: true });
    appDir = resolve(tempDir, "sample-app");
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should build successfully", () => {
    const result = runCommand(appDir, "build");
    expect(result.success).toBe(true);
    expect(result.output).toContain("Build completed");
  });

  it("should generate ESM output", () => {
    expect(existsSync(resolve(appDir, "dist/index.js"))).toBe(true);
    const content = readFileSync(resolve(appDir, "dist/index.js"), "utf8");
    expect(content).toContain("Hello from sample app");
  });

  it("should NOT generate CJS output", () => {
    expect(existsSync(resolve(appDir, "dist/index.cjs"))).toBe(false);
  });

  it("should generate type declarations", () => {
    expect(existsSync(resolve(appDir, "dist/index.d.ts"))).toBe(true);
  });

  it("should generate source maps", () => {
    expect(existsSync(resolve(appDir, "dist/index.js.map"))).toBe(true);
  });
});
