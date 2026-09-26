# Repo structure

The shared `@jterrazz` doctrine — the corpus, the injection layers, the compiler; projections vs presentations; root-file layout — lives in `jterrazz-studio`'s [`docs/11-repo-structure.md`](https://github.com/jterrazz/jterrazz-studio/blob/main/docs/11-repo-structure.md) and the `jterrazz-repo-structure` skill it ships. This chapter does not restate it.

What is TypeScript-specific stays here: this repo is a **package**, and a package's API is its types. No reference is generated from them — the declarations a consumer's editor resolves are the one copy, and a projection of them into `docs/` would be a second.

The doctrine's `docs/` spine — the four fixed chapter names, the two subfolders, the `AGENTS.md` route — is the one part this toolchain does not merely follow: it enforces it, for every repository of the ecosystem, whatever the language. The doctrine's text stays `jterrazz-studio`'s; the rule ids and what each one refuses are [Quality checks](06-quality-checks.md)'s, where they are executable.

The root is held to a spine as well — `src/`, `lint/` where the package ships it, `specs/`, `docs/`, `skills/`, and `apps/` or `packages/` in a workspace, each member held to a spine of its own. The Names (tree) pass refuses a skill that is more than its `SKILL.md`, any other root folder unless the ecosystem imposes it (npm's `bin/`, a framework's `public/`) or the repository declares it with a reason, and a repository whose `Makefile` does not answer `install`, `build`, `lint`, `fix`, `test` and `check` ([Quality checks](06-quality-checks.md#the-repository-spine)).

## Related

- [Quality checks](06-quality-checks.md) — the Docs (layout) pass and the repository spine.
