import { describe, test } from "vitest";

import { spec } from "../../setup/cli.specification.js";

describe("dev", () => {
  test("shows startup message", async () => {
    // Given — dev mode on sample app
    const result = await spec("dev startup")
      .project("sample-app")
      .spawn("dev", { waitFor: "Starting dev mode", timeout: 10_000 })
      .run();

    // Then — banner and startup message appear
    result.exitCode.toBe(0);
    result.stdout.toContain("TYPESCRIPT");
    result.stdout.toContain("Starting dev mode");
  });

  test("builds and runs the app in watch mode", async () => {
    // Given — dev mode on sample app
    const result = await spec("dev build+run")
      .project("sample-app")
      .spawn("dev", { waitFor: "Hello from sample app", timeout: 15_000 })
      .run();

    // Then — app output appears (build succeeded and app ran)
    result.exitCode.toBe(0);
    result.stdout.toContain("Hello from sample app");
  });
});
