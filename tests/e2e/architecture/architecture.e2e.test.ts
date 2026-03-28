import { resolve } from "node:path";
import { beforeAll, describe, test } from "vitest";

import { oxlintSpec } from "../../setup/oxlint.specification.js";

const ROOT_DIR = resolve(import.meta.dirname, "../../..");
const HEXAGONAL_CONFIG = resolve(ROOT_DIR, "presets/oxlint/architectures/hexagonal.json");
const HEXAGONAL_DIR = resolve(import.meta.dirname, "hexagonal");

describe("architecture", () => {
  let result: any;

  beforeAll(async () => {
    // Given — run oxlint with hexagonal config on fixture dir (absolute path for plugin resolution)
    result = await oxlintSpec("hexagonal").exec(`-c ${HEXAGONAL_CONFIG} ${HEXAGONAL_DIR}`).run();
  });

  describe("domain layer", () => {
    test("allows pure domain files", () => {
      // Then — arch-hexagonal does NOT trigger on valid domain
      result.stdout.not.toContain("arch-hexagonal", { near: "domain/user.entity.ts" });
    });

    test("rejects domain importing infrastructure", () => {
      // Then — arch-hexagonal triggers on invalid domain import
      result.stdout.toContain("arch-hexagonal", { near: "domain/invalid-domain.ts" });
    });
  });

  describe("application layer", () => {
    test("allows use cases importing domain", () => {
      // Then — arch-hexagonal does NOT trigger on valid use case
      result.stdout.not.toContain("arch-hexagonal", {
        near: "application/use-cases/get-user.ts",
      });
    });

    test("rejects use cases importing infrastructure", () => {
      // Then — arch-hexagonal triggers on invalid use case
      result.stdout.toContain("arch-hexagonal", {
        near: "application/use-cases/invalid-use-case.ts",
      });
    });
  });

  describe("presentation layer", () => {
    test("allows pure UI atoms", () => {
      // Then — arch-hexagonal does NOT trigger on valid atom
      result.stdout.not.toContain("arch-hexagonal", {
        near: "presentation/ui/atoms/button.tsx",
      });
    });

    test("rejects atoms importing navigation", () => {
      // Then — arch-hexagonal triggers on invalid atom
      result.stdout.toContain("arch-hexagonal", {
        near: "presentation/ui/atoms/invalid-atom.tsx",
      });
    });
  });
});
