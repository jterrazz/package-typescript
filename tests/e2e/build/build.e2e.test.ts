import { describe, test } from "vitest";

import { spec } from "../../setup/cli.specification.js";

describe("build", () => {
  test("builds successfully", async () => {
    const result = await spec("build").project("sample-app").exec("build").run();

    result.expectExitCode(0);
    result.expectStdoutContains("Build completed");
  });

  test("generates ESM output", async () => {
    const result = await spec("esm output").project("sample-app").exec("build").run();

    result.expectFile("dist/index.js");
    result.expectFileContains("dist/index.js", "Hello from sample app");
  });

  test("does NOT generate CJS output", async () => {
    const result = await spec("no cjs").project("sample-app").exec("build").run();

    result.expectNoFile("dist/index.cjs");
  });

  test("generates type declarations", async () => {
    const result = await spec("types").project("sample-app").exec("build").run();

    result.expectFile("dist/index.d.ts");
  });

  test("generates source maps", async () => {
    const result = await spec("sourcemaps").project("sample-app").exec("build").run();

    result.expectFile("dist/index.js.map");
  });
});
