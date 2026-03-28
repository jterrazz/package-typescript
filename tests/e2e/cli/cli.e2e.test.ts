import { describe, expect, test } from "vitest";

import { spec } from "../../setup/cli.specification.js";

describe("cli", () => {
  test("shows help when no command is provided", async () => {
    // Given — no command argument
    const result = await spec("help").project("sample-app").exec("").run();

    // Then — help banner with usage and available commands
    expect(result.stdout).toContain("TYPESCRIPT");
    expect(result.stdout).toContain("Usage: typescript <command>");
    expect(result.stdout).toContain("build");
    expect(result.stdout).toContain("dev");
  });

  test("shows help with unknown command", async () => {
    // Given — unrecognized command
    const result = await spec("unknown").project("sample-app").exec("unknown").run();

    // Then — falls back to usage help
    expect(result.stdout).toContain("Usage: typescript <command>");
  });

  test("lists all commands in help", async () => {
    // Given — no command argument
    const result = await spec("commands").project("sample-app").exec("").run();

    // Then — all four commands listed
    expect(result.stdout).toContain("build");
    expect(result.stdout).toContain("bundle");
    expect(result.stdout).toContain("start");
    expect(result.stdout).toContain("dev");
  });

  test("shows usage examples in help", async () => {
    // Given — no command argument
    const result = await spec("examples").project("sample-app").exec("").run();

    // Then — usage examples for each command
    expect(result.stdout).toContain("typescript build");
    expect(result.stdout).toContain("typescript bundle");
    expect(result.stdout).toContain("typescript start");
    expect(result.stdout).toContain("typescript dev");
  });
});
