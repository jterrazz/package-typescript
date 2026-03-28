import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";

import { oxfmtSpec } from "../../setup/oxfmt.specification.js";

const ROOT_DIR = resolve(import.meta.dirname, "../../..");
const CONFIG_PATH = resolve(ROOT_DIR, "presets/oxfmt/index.json");

describe("formatter", () => {
  describe("format checking", () => {
    test("detects unformatted code", async () => {
      // Given — file with wrong formatting
      const result = await oxfmtSpec("check wrong")
        .project("formatter")
        .exec(`--check --config ${CONFIG_PATH} inputs/wrong-style.ts`)
        .run();

      // Then — check fails
      expect(result.exitCode).toBe(1);
    });

    test("passes for properly formatted code", async () => {
      // Given — file with correct formatting
      const result = await oxfmtSpec("check correct")
        .project("formatter")
        .exec(`--check --config ${CONFIG_PATH} expected/correct-style.ts`)
        .run();

      // Then — check passes
      expect(result.exitCode).toBe(0);
    });
  });

  describe("format fixing", () => {
    test("formats unformatted code correctly", async () => {
      // Given — format the wrong-style file in place
      const result = await oxfmtSpec("fix wrong")
        .project("formatter")
        .exec(`--config ${CONFIG_PATH} inputs/wrong-style.ts`)
        .run();

      // Then — file is reformatted with correct style
      expect(result.exitCode).toBe(0);
      expect(result.file("inputs/wrong-style.ts").content).toContain("import fs from 'fs';");
      expect(result.file("inputs/wrong-style.ts").content).toContain(
        "function greet(name: string): string",
      );
      expect(result.file("inputs/wrong-style.ts").content).toMatch(/^\s{4}const/m);
    });

    test("is idempotent (formatting twice gives same result)", async () => {
      // Given — already-correct file
      const result = await oxfmtSpec("idempotent")
        .project("formatter")
        .exec(`--config ${CONFIG_PATH} expected/correct-style.ts`)
        .run();

      // Then — file unchanged after formatting
      expect(result.exitCode).toBe(0);
      const original = readFileSync(
        resolve(import.meta.dirname, "expected/correct-style.ts"),
        "utf8",
      );
      expect(result.file("expected/correct-style.ts").content).toContain(original.trim());
    });
  });

  describe("config options", () => {
    let result: any;

    beforeAll(async () => {
      // Given — format the wrong-style file
      result = await oxfmtSpec("config options")
        .project("formatter")
        .exec(`--config ${CONFIG_PATH} inputs/wrong-style.ts`)
        .run();
    });

    test("uses single quotes", () => {
      // Then — single quotes for imports
      expect(result.file("inputs/wrong-style.ts").content).toContain("'fs'");
    });

    test("uses semicolons", () => {
      // Then — statements end with semicolons
      expect(result.file("inputs/wrong-style.ts").content).toMatch(/;\s*$/m);
    });

    test("uses 4-space indentation", () => {
      // Then — indented lines use 4 spaces
      expect(result.file("inputs/wrong-style.ts").content).toMatch(/^\s{4}const/m);
    });
  });
});
