import { describe, expect, test } from "vitest";

import { spec } from "../../setup/cli.specification.js";

describe("bundle", () => {
  test("bundles successfully", async () => {
    // Given — sample library project
    const result = await spec("bundle").project("sample-lib").exec("bundle").run();

    // Then — ESM + CJS bundle completes
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Build completed");
  });

  test("generates ESM output with exports", async () => {
    // Given — sample library project
    const result = await spec("esm output").project("sample-lib").exec("bundle").run();

    // Then — ESM module with export statements
    expect(result.file("dist/index.js").exists).toBe(true);
    expect(result.file("dist/index.js").content).toContain("export");
  });

  test("generates CJS output with exports", async () => {
    // Given — sample library project
    const result = await spec("cjs output").project("sample-lib").exec("bundle").run();

    // Then — CommonJS module with exports
    expect(result.file("dist/index.cjs").exists).toBe(true);
    expect(result.file("dist/index.cjs").content).toContain("exports");
  });

  test("generates type declarations with public API", async () => {
    // Given — sample library project
    const result = await spec("types").project("sample-lib").exec("bundle").run();

    // Then — declaration file exposes all public types
    expect(result.file("dist/index.d.ts").exists).toBe(true);
    expect(result.file("dist/index.d.ts").content).toContain("greet");
    expect(result.file("dist/index.d.ts").content).toContain("User");
  });

  test("generates source maps for both formats", async () => {
    // Given — sample library project
    const result = await spec("sourcemaps").project("sample-lib").exec("bundle").run();

    // Then — both ESM and CJS have source maps
    expect(result.file("dist/index.js.map").exists).toBe(true);
    expect(result.file("dist/index.cjs.map").exists).toBe(true);
  });
});
