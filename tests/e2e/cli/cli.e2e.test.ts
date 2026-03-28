import { describe, test } from "vitest";

import { spec } from "../../setup/cli.specification.js";

describe("cli", () => {
  test("shows help when no command is provided", async () => {
    const result = await spec("help").project("sample-app").exec("").run();

    // Then — help banner with usage and available commands
    result.expectStdoutContains("TYPESCRIPT");
    result.expectStdoutContains("Usage: typescript <command>");
    result.expectStdoutContains("build");
    result.expectStdoutContains("dev");
  });

  test("shows help with unknown command", async () => {
    // Given — unrecognized command
    const result = await spec("unknown").project("sample-app").exec("unknown").run();

    result.expectStdoutContains("Usage: typescript <command>");
  });

  test("shows all commands in help", async () => {
    const result = await spec("commands").project("sample-app").exec("").run();

    // Then — all four commands listed
    result
      .expectStdoutContains("build")
      .expectStdoutContains("bundle")
      .expectStdoutContains("start")
      .expectStdoutContains("dev");
  });

  test("shows examples in help", async () => {
    const result = await spec("examples").project("sample-app").exec("").run();

    // Then — usage examples for each command
    result
      .expectStdoutContains("typescript build")
      .expectStdoutContains("typescript bundle")
      .expectStdoutContains("typescript start")
      .expectStdoutContains("typescript dev");
  });
});
