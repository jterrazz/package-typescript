import { describe, test } from "vitest";

import { spec } from "../../setup/cli.specification.js";

describe("build", () => {
  test("builds successfully", async () => {
    // Given — sample app project
    const result = await spec("build").project("sample-app").exec("build").run();

    // Then — ESM build completes
    result.exitCode.toBe(0);
    result.stdout.toContain("Build completed");
  });

  test("generates ESM output with source content", async () => {
    // Given — sample app project
    const result = await spec("esm output").project("sample-app").exec("build").run();

    // Then — dist contains the app code
    result.file("dist/index.js").toExist();
    result.file("dist/index.js").toContain("Hello from sample app");
  });

  test("does NOT generate CJS output", async () => {
    // Given — app build (not library bundle)
    const result = await spec("no cjs").project("sample-app").exec("build").run();

    // Then — no CommonJS file
    result.file("dist/index.cjs").not.toExist();
  });

  test("generates type declarations", async () => {
    // Given — sample app project
    const result = await spec("types").project("sample-app").exec("build").run();

    // Then — declaration file exists
    result.file("dist/index.d.ts").toExist();
  });

  test("generates source maps", async () => {
    // Given — sample app project
    const result = await spec("sourcemaps").project("sample-app").exec("build").run();

    // Then — source map exists
    result.file("dist/index.js.map").toExist();
  });
});
