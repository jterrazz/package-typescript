import { describe, test } from "vitest";

import { spec } from "../../setup/cli.specification.js";

describe("bundle", () => {
  test("bundles successfully", async () => {
    // Given — sample library project
    const result = await spec("bundle").project("sample-lib").exec("bundle").run();

    // Then — ESM + CJS bundle completes
    result.exitCode.toBe(0);
    result.stdout.toContain("Build completed");
  });

  test("generates ESM output with exports", async () => {
    // Given — sample library project
    const result = await spec("esm output").project("sample-lib").exec("bundle").run();

    // Then — ESM module with export statements
    result.file("dist/index.js").toExist();
    result.file("dist/index.js").toContain("export");
  });

  test("generates CJS output with exports", async () => {
    // Given — sample library project
    const result = await spec("cjs output").project("sample-lib").exec("bundle").run();

    // Then — CommonJS module with exports
    result.file("dist/index.cjs").toExist();
    result.file("dist/index.cjs").toContain("exports");
  });

  test("generates type declarations with public API", async () => {
    // Given — sample library project
    const result = await spec("types").project("sample-lib").exec("bundle").run();

    // Then — declaration file exposes all public types
    result.file("dist/index.d.ts").toExist();
    result.file("dist/index.d.ts").toContain("greet");
    result.file("dist/index.d.ts").toContain("User");
  });

  test("generates source maps for both formats", async () => {
    // Given — sample library project
    const result = await spec("sourcemaps").project("sample-lib").exec("bundle").run();

    // Then — both ESM and CJS have source maps
    result.file("dist/index.js.map").toExist();
    result.file("dist/index.cjs.map").toExist();
  });
});
