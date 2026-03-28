import { resolve } from "node:path";
import { beforeAll, describe, test } from "vitest";

import { oxlintSpec } from "../../setup/oxlint.specification.js";

const ROOT_DIR = resolve(import.meta.dirname, "../../..");
const BASE_CONFIG = resolve(ROOT_DIR, "presets/oxlint/base.json");
const NODE_CONFIG = resolve(ROOT_DIR, "presets/oxlint/node.json");
const EXPO_CONFIG = resolve(ROOT_DIR, "presets/oxlint/expo.json");
const NEXT_CONFIG = resolve(ROOT_DIR, "presets/oxlint/next.json");
const VALID_DIR = resolve(import.meta.dirname, "valid");
const INVALID_DIR = resolve(import.meta.dirname, "invalid");

describe("linter", () => {
  let baseResult: any;
  let nodeResult: any;
  let expoResult: any;
  let nextResult: any;

  beforeAll(async () => {
    // Given — run oxlint once per config on fixture dirs (absolute paths for JS plugin resolution)
    [baseResult, nodeResult, expoResult, nextResult] = await Promise.all([
      oxlintSpec("base").exec(`-c ${BASE_CONFIG} ${VALID_DIR} ${INVALID_DIR}`).run(),
      oxlintSpec("node").exec(`-c ${NODE_CONFIG} ${VALID_DIR} ${INVALID_DIR}`).run(),
      oxlintSpec("expo").exec(`-c ${EXPO_CONFIG} ${VALID_DIR} ${INVALID_DIR}`).run(),
      oxlintSpec("next").exec(`-c ${NEXT_CONFIG} ${VALID_DIR} ${INVALID_DIR}`).run(),
    ]);
  });

  describe("base config", () => {
    test("detects unused variables", () => {
      // Then — rule triggers on invalid file
      baseResult.stdout.toContain("no-unused-vars", { near: "invalid/unused-var.ts" });
    });

    test("requires type imports for type-only imports", () => {
      // Then — error on wrong import, pass on correct one
      baseResult.stdout.toContain("consistent-type-imports", { near: "invalid/type-import.ts" });
      baseResult.stdout.not.toContain("consistent-type-imports", {
        near: "valid/type-import.ts",
      });
    });

    test("detects unused expressions", () => {
      // Then — unused expression detected
      baseResult.stdout.toContain("no-unused-expressions", {
        near: "invalid/unused-expression.ts",
      });
    });

    test("detects unsorted imports", () => {
      // Then — error on unsorted, pass on sorted
      baseResult.stdout.toContain("sort-imports", { near: "invalid/unsorted-imports.ts" });
      baseResult.stdout.not.toContain("sort-imports", { near: "valid/sorted.ts" });
    });

    test("detects unsorted union types", () => {
      // Then — error on unsorted, pass on sorted
      baseResult.stdout.toContain("sort-union-types", { near: "invalid/unsorted-union.ts" });
      baseResult.stdout.not.toContain("sort-union-types", { near: "valid/sorted-union.ts" });
    });

    test("detects unsorted named exports", () => {
      // Then — error on unsorted, pass on sorted
      baseResult.stdout.toContain("sort-named-exports", {
        near: "invalid/unsorted-named-exports.ts",
      });
      baseResult.stdout.not.toContain("sort-named-exports", {
        near: "valid/sorted-named-exports.ts",
      });
    });

    test("warns about spread in reduce accumulator", () => {
      // Then — perf rule triggers
      baseResult.stdout.toContain("no-accumulating-spread", {
        near: "invalid/perf-spread-in-accumulator.ts",
      });
    });

    test("allows default exports", () => {
      // Then — no-default-export rule is not active
      baseResult.stdout.not.toContain("no-default-export", {
        near: "invalid/default-export.ts",
      });
      baseResult.stdout.not.toContain("no-default-export", {
        near: "valid/named-export.ts",
      });
    });

    test("rejects imports not at top", () => {
      // Then — import/first rule triggers
      baseResult.stdout.toContain("first", { near: "invalid/import-not-first.ts" });
    });

    test("rejects namespace imports", () => {
      // Then — no-namespace rule triggers
      baseResult.stdout.toContain("no-namespace", { near: "invalid/namespace-import.ts" });
    });

    test("requires error variable named error", () => {
      // Then — catch-error-name rule triggers
      baseResult.stdout.toContain("catch-error-name", {
        near: "invalid/catch-error-name.ts",
      });
    });

    test("requires numeric separators on large numbers", () => {
      // Then — numeric separators rule triggers
      baseResult.stdout.toContain("numeric-separators", {
        near: "invalid/numeric-separators.ts",
      });
    });

    test("rejects nested ternary", () => {
      // Then — nested-ternary rule triggers
      baseResult.stdout.toContain("nested-ternary", { near: "invalid/nested-ternary.ts" });
    });

    test("requires curly braces", () => {
      // Then — curly rule triggers
      baseResult.stdout.toContain("curly", { near: "invalid/curly.ts" });
    });

    test("warns about lowercase comments", () => {
      // Then — capitalized-comments rule triggers
      baseResult.stdout.toContain("capitalized-comments", {
        near: "invalid/capitalized-comment.ts",
      });
    });

    describe("disabled rules", () => {
      test("allows lowercase constructor names (new-cap disabled)", () => {
        // Then — new-cap does NOT trigger
        baseResult.stdout.not.toContain("new-cap", { near: "valid/new-cap.ts" });
      });

      test("allows unassigned imports (no-unassigned-import disabled)", () => {
        // Then — rule does NOT trigger
        baseResult.stdout.not.toContain("no-unassigned-import", {
          near: "valid/unassigned-import.ts",
        });
      });

      test("allows await in loops (no-await-in-loop disabled)", () => {
        // Then — rule does NOT trigger
        baseResult.stdout.not.toContain("no-await-in-loop", {
          near: "valid/await-in-loop.ts",
        });
      });

      test("allows named default imports (no-named-default disabled)", () => {
        // Then — rule does NOT trigger
        baseResult.stdout.not.toContain("no-named-default", {
          near: "valid/named-default.ts",
        });
      });

      test("allows inferrable type annotations (no-inferrable-types disabled)", () => {
        // Then — rule does NOT trigger
        baseResult.stdout.not.toContain("no-inferrable-types", {
          near: "valid/inferrable-types.ts",
        });
      });
    });
  });

  describe("node config", () => {
    test("requires .js extension on relative imports", () => {
      // Then — imports-with-ext rule triggers on missing extension
      nodeResult.stdout.toContain("imports-with-ext", { near: "invalid/missing-js-ext.ts" });
    });

    test("passes when .js extension is present", () => {
      // Then — rule does NOT trigger on valid file
      nodeResult.stdout.not.toContain("imports-with-ext", { near: "valid/sorted.ts" });
    });

    test("inherits base rules", () => {
      // Then — base rule still works in node config
      nodeResult.stdout.toContain("no-unused-vars", { near: "invalid/unused-var.ts" });
    });
  });

  describe("expo config", () => {
    test("rejects .ts extension on relative imports", () => {
      // Then — imports-without-ext rule triggers
      expoResult.stdout.toContain("imports-without-ext", { near: "invalid/has-ts-ext.ts" });
    });

    test("passes when no extension on relative imports", () => {
      // Then — rule does NOT trigger on valid file
      expoResult.stdout.not.toContain("imports-without-ext", {
        near: "valid/sorted-no-ext.ts",
      });
    });

    test("inherits base rules", () => {
      // Then — base rule still works in expo config
      expoResult.stdout.toContain("sort-imports", { near: "invalid/unsorted-imports.ts" });
    });
  });

  describe("nextjs config", () => {
    test("rejects .ts extension on relative imports", () => {
      // Then — imports-without-ext rule triggers
      nextResult.stdout.toContain("imports-without-ext", { near: "invalid/has-ts-ext.ts" });
    });

    test("passes when no extension on relative imports", () => {
      // Then — rule does NOT trigger on valid file
      nextResult.stdout.not.toContain("imports-without-ext", {
        near: "valid/sorted-no-ext.ts",
      });
    });

    test("inherits base rules", () => {
      // Then — base rule still works in nextjs config
      nextResult.stdout.toContain("no-unused-vars", { near: "invalid/unused-var.ts" });
    });
  });
});
