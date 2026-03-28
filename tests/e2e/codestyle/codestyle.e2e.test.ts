import { describe, expect, test } from "vitest";

import { codestyleSpec } from "../../setup/codestyle.specification.js";

describe("codestyle", () => {
  test("shows help when no command is provided", async () => {
    // Given — run codestyle with no arguments
    const result = await codestyleSpec("no command").exec("").run();

    // Then — prints usage information and exits with non-zero
    expect(result.stdout).toContain("codestyle");
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("check");
    expect(result.stdout).toContain("fix");
    expect(result.exitCode).toBe(1);
  });

  test("check runs all three tools", async () => {
    // Given — run codestyle check from the project root, ignoring fixture directories
    const result = await codestyleSpec("check all tools")
      .exec(
        "check --ignore-pattern '**/fixtures/**' --ignore-pattern '**/invalid/**' --ignore-pattern '**/hexagonal/**'",
      )
      .run();

    // Then — output contains sections for each tool
    expect(result.stdout).toContain("TypeScript Check");
    expect(result.stdout).toContain("Oxlint");
    expect(result.stdout).toContain("Oxfmt");
  });

  test("check reports quality checks label", async () => {
    // Given — run codestyle check
    const result = await codestyleSpec("check label")
      .exec(
        "check --ignore-pattern '**/fixtures/**' --ignore-pattern '**/invalid/**' --ignore-pattern '**/hexagonal/**'",
      )
      .run();

    // Then — output contains the quality checks banner
    expect(result.stdout).toContain("Running quality checks");
  });

  test("fix reports quality fixes label", async () => {
    // Given — run codestyle fix
    const result = await codestyleSpec("fix label")
      .exec(
        "fix --ignore-pattern '**/fixtures/**' --ignore-pattern '**/invalid/**' --ignore-pattern '**/hexagonal/**'",
      )
      .run();

    // Then — output contains the quality fixes banner
    expect(result.stdout).toContain("Running quality fixes");
  });
});
