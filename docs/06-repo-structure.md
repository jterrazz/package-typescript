# Repo structure

The shared `@jterrazz` doctrine — the corpus, the injection layers, the compiler; projections vs presentations; root-file layout — lives in `jterrazz-studio`'s [`docs/08-repo-structure.md`](https://github.com/jterrazz/jterrazz-studio/blob/main/docs/08-repo-structure.md) and the `jterrazz-repo-structure` skill it ships. This chapter does not restate it.

What is TypeScript-specific stays here: this repo is a **package**, so it runs the compiler half of the doctrine — `typescript docs` projects the source barrel into the committed `docs/reference/` tree, kept honest by a sync check.

## Related

- [Docs pipeline](05-docs-pipeline.md) — the compiler and its projections.
- [Quality checks](03-quality-checks.md) — the Docs (sync) pass.
