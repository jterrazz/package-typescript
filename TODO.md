# TODO — the product backlog

What this package intends to do next, and nothing else. A decision that has been taken is a
record under `docs/decisions/`; what a release carries is its GitHub release notes. An item
delivered leaves this file.

---

- **`typescript baseline` resolves oxlint apart from `check`.** `check` asks
  `projectBinary` (the member's `node_modules/.bin`, then the `.bin` hoisted beside this
  package); `baseline` asks `binaryIn('oxlint', <member>/node_modules/.bin)`, which never looks
  beside the package. In an npm-hoisted workspace member the command the adopt flow prescribes
  falls back to whatever `oxlint` the `PATH` holds. One resolver for both, with a hoisted
  member among the specs' fixtures.
- **A Publish finding in a workspace does not name its member.** The three `package.json`
  findings carry the member-relative path `package.json`, so a workspace of two publishable
  packages prints two lines a reader cannot tell apart; only the nothing-to-judge note says
  `in <member>`.
