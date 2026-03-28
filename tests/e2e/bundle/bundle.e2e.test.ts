import { describe, test } from "vitest";

import { spec } from "../../setup/cli.specification.js";

describe("bundle", () => {
  test("bundles successfully", async () => {
    const result = await spec("bundle").project("sample-lib").exec("bundle").run();

    result.expectExitCode(0);
    result.expectStdoutContains("Build completed");
  });

  test("generates ESM output", async () => {
    const result = await spec("esm output").project("sample-lib").exec("bundle").run();

    result.expectFile("dist/index.js");
    result.expectFileContains("dist/index.js", "export");
  });

  test("generates CJS output", async () => {
    const result = await spec("cjs output").project("sample-lib").exec("bundle").run();

    result.expectFile("dist/index.cjs");
    result.expectFileContains("dist/index.cjs", "exports");
  });

  test("generates type declarations", async () => {
    const result = await spec("types").project("sample-lib").exec("bundle").run();

    result.expectFile("dist/index.d.ts");
    result.expectFileContains("dist/index.d.ts", "greet");
    result.expectFileContains("dist/index.d.ts", "User");
  });

  test("generates source maps", async () => {
    const result = await spec("sourcemaps").project("sample-lib").exec("bundle").run();

    result.expectFile("dist/index.js.map");
    result.expectFile("dist/index.cjs.map");
  });
});
