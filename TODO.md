# TODO: the product backlog

What this package intends to do next, and nothing else. A decision that has been taken is a
record under `docs/decisions/`; what a release carries is its GitHub release notes. An item
delivered leaves this file.

---

- **No gate finds an unused class member, nor code only a test reads.** knip 6 dropped the
  `classMembers` issue type, so a getter or method nobody calls survives every pass
  (signews-mobile's entity and repository members); and knip counts a test's import as a use,
  so a use case read by its own test alone is never reported. The answer is a pass of its own:
  the TypeScript language service's references, one run per class member, and a second knip
  run in production mode (`--production`, test entries off) whose unused exports and files
  are reported apart. The pass is measured on the wave before it is armed.
- **No check finds an unused translation key.** A locale file's keys are read by `t('...')`
  literals the type check never connects to them; signews-mobile's heuristic sweep listed
  ~100 candidates in `en.json`. A check that intersects the locale keys with every literal
  key the source passes to `t()`, and refuses to judge a key a dynamic prefix could reach,
  needs the locale folder declared per project (`typescript.i18n`) before it can run.
- **The type-aware oxlint run once printed 256 findings, then ~1000 on the same tree.** Seen
  once in the OS pilot, never reproduced. If it recurs, keep both logs and whether
  `tsgolint` exited early; a warning when its worker ends before the last file is the first
  gate to add.
