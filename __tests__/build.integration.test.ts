import { execSync } from "child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT_DIR = resolve(import.meta.dirname, "..");
const FIXTURES_DIR = resolve(import.meta.dirname, "fixtures");
const RUNNER_BIN = resolve(ROOT_DIR, "bin/typescript.sh");

type BuildResult = {
  success: boolean;
  output: string;
};

function runCommand(projectDir: string, command: string): BuildResult {
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
  let libDir: string;
  let appDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), "runner-build-test-"));
    cpSync(FIXTURES_DIR, tempDir, { recursive: true });
    libDir = resolve(tempDir, "sample-lib");
    appDir = resolve(tempDir, "sample-app");
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("bundle (library)", () => {
    it("should build successfully", () => {
      const result = runCommand(libDir, "bundle");
      expect(result.success).toBe(true);
      expect(result.output).toContain("Build completed");
    });

    it("should generate ESM output", () => {
      expect(existsSync(resolve(libDir, "dist/index.js"))).toBe(true);
      const content = readFileSync(resolve(libDir, "dist/index.js"), "utf8");
      expect(content).toContain("export");
    });

    it("should generate CJS output", () => {
      expect(existsSync(resolve(libDir, "dist/index.cjs"))).toBe(true);
      const content = readFileSync(resolve(libDir, "dist/index.cjs"), "utf8");
      expect(content).toContain("exports");
    });

    it("should generate type declarations", () => {
      expect(existsSync(resolve(libDir, "dist/index.d.ts"))).toBe(true);
      const content = readFileSync(resolve(libDir, "dist/index.d.ts"), "utf8");
      expect(content).toContain("greet");
      expect(content).toContain("User");
    });

    it("should generate source maps", () => {
      expect(existsSync(resolve(libDir, "dist/index.js.map"))).toBe(true);
      expect(existsSync(resolve(libDir, "dist/index.cjs.map"))).toBe(true);
    });
  });

  describe("build (application)", () => {
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

    it("should NOT generate CJS output for apps", () => {
      expect(existsSync(resolve(appDir, "dist/index.cjs"))).toBe(false);
    });

    it("should generate type declarations", () => {
      expect(existsSync(resolve(appDir, "dist/index.d.ts"))).toBe(true);
    });

    it("should generate source maps", () => {
      expect(existsSync(resolve(appDir, "dist/index.js.map"))).toBe(true);
    });
  });
});
