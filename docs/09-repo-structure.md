# Repo structure

The shared `@jterrazz` doctrine — the corpus, the injection layers, the compiler; projections vs presentations; root-file layout — lives in `jterrazz-studio`'s [`docs/08-repo-structure.md`](https://github.com/jterrazz/jterrazz-studio/blob/main/docs/08-repo-structure.md) and the `jterrazz-repo-structure` skill it ships. This chapter does not restate it.

What is TypeScript-specific stays here: this repo is a **package**, so it runs the compiler half of the doctrine — `typescript docs` projects the source barrel into the committed `docs/reference/` tree, kept honest by a sync check.

The doctrine's `docs/` spine — the four fixed chapter names, the three subfolders, the `AGENTS.md` route — is the one part this toolchain does not merely follow: it enforces it, for every repository of the ecosystem, whatever the language. The doctrine's text stays `jterrazz-studio`'s; the rule ids and what each one refuses are [Quality checks](06-quality-checks.md)'s, where they are executable.

## Related

- [Docs pipeline](08-docs-pipeline.md) — the compiler and its projections.
- [Quality checks](06-quality-checks.md) — the Docs (sync) and Docs (layout) passes.
