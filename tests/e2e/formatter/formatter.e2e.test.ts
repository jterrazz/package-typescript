import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, test } from "vitest";

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
      result.exitCode.toBe(1);
    });

    test("passes for properly formatted code", async () => {
      // Given — file with correct formatting
      const result = await oxfmtSpec("check correct")
        .project("formatter")
        .exec(`--check --config ${CONFIG_PATH} expected/correct-style.ts`)
        .run();

      // Then — check passes
      result.exitCode.toBe(0);
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
      result.exitCode.toBe(0);
      result.file("inputs/wrong-style.ts").toContain("import fs from 'fs';");
      result.file("inputs/wrong-style.ts").toContain("function greet(name: string): string");
      result.file("inputs/wrong-style.ts").toMatch(/^\s{4}const/m);
    });

    test("is idempotent (formatting twice gives same result)", async () => {
      // Given — already-correct file
      const result = await oxfmtSpec("idempotent")
        .project("formatter")
        .exec(`--config ${CONFIG_PATH} expected/correct-style.ts`)
        .run();

      // Then — file unchanged after formatting
      result.exitCode.toBe(0);
      const original = readFileSync(
        resolve(import.meta.dirname, "expected/correct-style.ts"),
        "utf8",
      );
      result.file("expected/correct-style.ts").toContain(original.trim());
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
      result.file("inputs/wrong-style.ts").toContain("'fs'");
    });

    test("uses semicolons", () => {
      // Then — statements end with semicolons
      result.file("inputs/wrong-style.ts").toMatch(/;\s*$/m);
    });

    test("uses 4-space indentation", () => {
      // Then — indented lines use 4 spaces
      result.file("inputs/wrong-style.ts").toMatch(/^\s{4}const/m);
    });
  });
});
