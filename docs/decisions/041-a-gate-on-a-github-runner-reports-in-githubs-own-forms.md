# ADR-041: A gate on a GitHub runner reports in GitHub's own forms

**Status:** Proposed
**Date:** 2026-10-29

## Context

`check` prints for a terminal: a block per pass, each failing pass's whole
log, and findings on one line in four parts, `found · why · fix · read`. On
a GitHub runner that log is read through the job page, where a long run of
long lines is scrolled, never scanned. Only oxlint annotated anything, from
its own workflow commands, with paths from the project rather than the
checkout; a monorepo member's annotation pointed at no file. A tree proven
green printed the runner's hostname, its checkout path and an ISO
timestamp, none of which a reader of the job page can act on.

The owner asked for the job page to read as the gate's verdict at a glance
(the `#toolchain` target of the studio pipeline plan, 2026-10-28).

## Decision

- Under `GITHUB_ACTIONS=true` the same passes run and decide the same
  verdict; only the report changes. Outside a runner nothing changes.
- One aligned line per pass: its short name, `✓` or `✗` with a count of
  findings, its seconds, or `cached` with the proof's minute and the
  `GITHUB_RUN_ID` that took it. The proof records that run id.
- A pass that printed something is a `::group::` fold titled by its line,
  with workflow commands stopped inside it (`::stop-commands::<token>`), so
  a tool's own annotations never reach GitHub twice and every annotation
  comes from one place.
- The run reads each pass's log for findings in the forms its tools print
  (the toolchain's lines, the compiler's, oxlint's workflow commands,
  knip's and oxfmt's lists), and prints each over several lines: rule and
  place, what was found, `fix`, `read`. The `why` stays in the fold.
- Each finding is one annotation, its path read from `GITHUB_WORKSPACE`,
  escaped as GitHub's workflow commands require.
- Where `GITHUB_STEP_SUMMARY` names a file, the run appends a table of its
  passes and its findings, capped at twenty and the rest counted.
- No `--explain` flag: the why is one fold away, and the terminal keeps it.

## Consequences

- A tool that changes its report's form can stop yielding findings: the
  pass still fails and still prints its fold, and is then one finding, its
  first line. The specs pin the forms read.
- The report on a runner is the toolchain's own rendering, which the rest
  of the gate avoids ([Quality checks § One run, printed as oxlint prints
  it](../reference/quality-checks.md#one-run-printed-as-oxlint-prints-it));
  it renders from the logs already written, so nothing runs twice.
- `test` and `mutation` keep their tools' own output when they run; only
  their proven-green hit takes the compact form.
