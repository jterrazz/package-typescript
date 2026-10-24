# ADR-037: A root file git does not track is an input only as configuration

**Status:** Proposed
**Date:** 2026-10-24

## Context

The record of [ADR-026](026-a-mutants-verdict-holds-while-its-source-and-the-tests-that-reach-it-hold.md)
hashes every file git lists, untracked files included, and reads a change
at the project's root as one every test reads, since a tool reads its
configuration there by name. On 2026-10-24 a `stryker.log` a measurement
left untracked at this package's root turned a suite dry run of 195 of 434
test files into every test file, and dropped the report whole: a file no
run reads cost a gate its record. The same path runs every test file of
`typescript test` ([ADR-034](034-a-test-run-runs-the-test-files-its-change-reaches.md)).
A file git ignores was never an input: the record lists the tree with
`--exclude-standard`.

## Decision

- A root file git does not track is an input only where a tool may read it
  as its configuration by its name: a dotfile, a module, a JSON, YAML or
  TOML file. Any other untracked root file (a log, a note, an archive) is
  no input of the record, so it neither widens a dry run or a test run nor
  drops a report.
- A tracked root file, and an untracked file in any folder, stay inputs as
  before: a project commits what configures it, and a file below the root
  is read by its path or by the reach of the code beside it.

## Consequences

- An untracked root file a test does read by a name outside those shapes
  (a fixture someone left at the root, say `data.txt`) changes no verdict
  until it is tracked: the record stops seeing it, as it never saw an
  ignored one. The green-verdict key of [ADR-033](033-a-green-verdict-holds-while-every-input-of-its-key-holds.md)
  still holds it, so a stage still runs on such a tree; it only runs what
  the record says the change reaches.
