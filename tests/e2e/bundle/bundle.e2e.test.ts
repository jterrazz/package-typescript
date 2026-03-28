import { describe, test } from "vitest";

import { spec } from "../../setup/cli.specification.js";

describe("bundle", () => {
  test("bundles successfully", async () => {
    // Given — sample library project
    const result = await spec("bundle").project("sample-lib").exec("bundle").run();

    // Then — ESM + CJS bundle completes
    result.expectExitCode(0);
    result.expectStdoutContains("Build completed");
  });

  test("generates ESM output with exports", async () => {
    // Given — sample library project
    const result = await spec("esm output").project("sample-lib").exec("bundle").run();

    // Then — ESM module with export statements
    result.expectFile("dist/index.js");
    result.expectFileContains("dist/index.js", "export");
  });

  test("generates CJS output with exports", async () => {
    // Given — sample library project
    const result = await spec("cjs output").project("sample-lib").exec("bundle").run();

    // Then — CommonJS module with exports
    result.expectFile("dist/index.cjs");
    result.expectFileContains("dist/index.cjs", "exports");
  });

  test("generates type declarations with public API", async () => {
    // Given — sample library project
    const result = await spec("types").project("sample-lib").exec("bundle").run();

    // Then — declaration file exposes all public types
    result.expectFile("dist/index.d.ts");
    result.expectFileContains("dist/index.d.ts", "greet");
    result.expectFileContains("dist/index.d.ts", "User");
  });

  test("generates source maps for both formats", async () => {
    // Given — sample library project
    const result = await spec("sourcemaps").project("sample-lib").exec("bundle").run();

    // Then — both ESM and CJS have source maps
    result.expectFile("dist/index.js.map");
    result.expectFile("dist/index.cjs.map");
  });
});
