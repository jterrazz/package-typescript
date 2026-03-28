import { describe, test } from "vitest";

import { spec } from "../../setup/cli.specification.js";

describe("cli", () => {
  test("shows help when no command is provided", async () => {
    const result = await spec("help").project("sample-app").exec("").run();

    result.expectStdoutContains("TYPESCRIPT");
    result.expectStdoutContains("Usage: typescript <command>");
    result.expectStdoutContains("build");
    result.expectStdoutContains("dev");
  });

  test("shows help with unknown command", async () => {
    const result = await spec("unknown").project("sample-app").exec("unknown").run();
    result.expectStdoutContains("Usage: typescript <command>");
  });

  test("shows all commands in help", async () => {
    const result = await spec("commands").project("sample-app").exec("").run();

    result
      .expectStdoutContains("build")
      .expectStdoutContains("bundle")
      .expectStdoutContains("start")
      .expectStdoutContains("dev");
  });

  test("shows examples in help", async () => {
    const result = await spec("examples").project("sample-app").exec("").run();

    result
      .expectStdoutContains("typescript build")
      .expectStdoutContains("typescript bundle")
      .expectStdoutContains("typescript start")
      .expectStdoutContains("typescript dev");
  });
});
