# ADR-020: Mutation measures the whole suite over a change

**Status:** Accepted
**Date:** 2026-10-04
**Accepted:** 2026-10-05 — the owner's word on the whole set ("ok parfait pour tout").

## Context

[ADR-019](019-mutation-judges-zero-survivors-not-a-score.md) left two kinds of
code with no mutation measure, and asked the owner's word on them. Code only
the specs prove: 351 mutants no module test runs in this package, 832 in
`@jterrazz/test`, 43 in signews-api, besides every source with no module test
at all. And static mutants — code that runs as a module loads, a table, a
pattern, a function's definition — which Stryker either reruns against every
test or skips under `ignoreStatic`: 515 skipped here, measured again on
f8c93e77, the commit before this decision. The static mutants a test also
called ran — 288 here, 648 in `@jterrazz/test` — but judged by a run that
activated the mutant only after the module had loaded, so that their survival
said nothing.

The specs spawn the built command. A run of the whole suite therefore needs
three things a run of the module tests does not: an instrumented build, the
active mutant handed to every spawned process, and each process's coverage
handed back, or Stryker sees no test reach the code and runs every test
against every mutant. Even with all three, a mutant costs a run of every test
that reaches it, and the specs of a command reach most of its code: over the
whole tree of this package the suite ran six mutants in eleven minutes, and
Stryker estimated sixty hours for the 11,200 the module tests left.

## Decision

- `typescript mutation` is two runs and one verdict, every mutant a test runs
  detected. The module tests run against the sources they test; the whole
  suite then runs against what they could not measure, on the lines the
  change touched — the working tree against `HEAD`, or against `--since` /
  `TYPESCRIPT_MUTATION_SINCE`, which the shared validate workflow sets to the
  commit a push or a pull request started from. A commit named that git
  cannot resolve is refused, since the suite would measure nothing and pass;
  a blank variable reads as unset. The suite starts only once the module
  tests' verdict passes.
- Every process a test spawns imports a reporter first. The parent hands it
  the active mutant; it hands back the mutants it ran — what is new every
  tenth of a second, the rest on exit — which the parent credits to the test
  that spawned it. A process a signal kills loses only its last tenth of a
  second, and one still running after its test file's last test hands back
  nothing more: what only it ran reads as run by no test.
- A mutant activates before the test file loads, so module-level code runs
  mutated. A static mutant is credited to every test of each file whose
  loading ran it, and runs against those tests alone. One they detect is
  detected; one they let live is left to the suite, since loading a module
  says nothing of whether a test reads what it defines. One a test also ran
  beyond loading its module — a function called to build a table and called
  again by a test — is the module tests' to answer, and its survival fails
  the run. Only what a test ran in its own process counts: a spawned
  process hands back its loading and its calls as one.
- A mutant the module tests left on a line no change has reached is counted,
  in one number, until a change brings it to the suite. `--mutate` points both
  runs at named lines, changed or not.

## Consequences

- Spec-proven code is measured where its source changes: no change lands with
  a changed source line the suite runs and lets change unseen. A change to a
  spec alone brings the suite nothing, so a weakened assertion is measured
  only when a later change reaches the lines it proves. A mutant the module
  tests left on a line no change has touched since is counted, not judged. A
  source with no module test beside it is mutated by no run until a change
  reaches it, so its mutants are neither judged nor counted: the verdict
  counts those sources, in one number of files.
- A change to code the specs reach everywhere costs, per surviving mutant, a
  run of every test reaching it — minutes each; the suite's dry run costs a
  build and a single-worker run of every node project — measured below —
  whenever a change reaches a line the module tests leave and their
  verdict passes.
- A test that cannot run against instrumented code — one reading the sources
  as text, one type-checking the built declarations — is excluded by
  `typescript.mutation.exclude`, with its reason.
- A mutant an instrumented build cannot bundle (an empty import specifier) is
  declared where it stands: it can reach no test.
- Measured when the decision was taken: every static mutant now runs. Here,
  where Stryker skipped 515, the module tests kill 597 static mutants and
  leave 220 to the suite; in `@jterrazz/test`, 2,245 killed and 983 left,
  where 648 had been judged with the mutant activated after their module
  loaded. A first module run of `@jterrazz/test` takes 75 minutes, an
  incremental one seconds; the suite's dry run here, four and a half
  minutes.
- A mutant that stops a test file from loading counts as detected: the
  file's failure is handed to Stryker as a failed test, which it would
  otherwise read as a survivor (213 of `@jterrazz/test`'s static mutants).
- Measured once a static mutant a test runs in its own process counts as a
  survivor (2026-10-05): of the static survivors left to the suite, 5 here
  and 105 in `@jterrazz/test` were such mutants — weak assertions and
  untested branches, now killed by tests or declared where no install of
  the package can tell them apart.
