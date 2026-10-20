# Triage a survivor

A survivor that fails `typescript mutation` is answered by a test or by a declaration, and this guide decides which, for a session or an agent working from the verdict file alone. The gate stays the judge: the triage writes code a reviewer reads, never a verdict ([ADR-029](../decisions/029-a-mutant-is-made-where-it-can-teach-and-judged-by-what-its-code-is.md)).

## What to read

The run writes `.artifacts/gate/verdict.json` ([Quality checks § The verdict file](../reference/quality-checks.md#the-verdict-file)). Each survivor that fails the run, in `mutation.survivors`, names everything the triage needs:

- `file`, `line` and `column`: the mutated node, as the terminal prints it (`src/discount.ts:2:9`);
- `mutator` and `replacement`: what Stryker changed, and into what (`ConditionalExpression`, `false`);
- `report`: the Stryker report that holds it, `.artifacts/stryker/report.json` for the module tests or `.artifacts/stryker/suite-report.json` for the whole suite; its entry for the mutant lists the tests that cover it (`coveredBy`);
- `role`: `domain`, held to zero survivors, or `glue`, held to the bar. A glue survivor fails the run only while glue is under its bar; `mutation.glue.survivors` lists every one, failing or not, the same fields each.

Read the source at the line, the replacement in its place, and the tests the report names. Nothing else is needed, and the commit that brought the line is not read: a triage judges the code as it stands.

## Real or equivalent

A survivor is real when some input makes the mutant behave differently from the original, as anything a caller can observe: a value returned, a value thrown, a file written, a line printed. Write the test that feeds that input and compares the observable whole. A real survivor is the common case.

A survivor is equivalent when no input can tell the two apart: a cache that only saves time, a comparator over keys that never tie, a guard the type system already makes unreachable. Before declaring one, rule out the five shapes that only look equivalent, since each has a rewrite that holds no mutant at all ([Quality checks § Writing what a mutant can tell from the original](../reference/quality-checks.md#writing-what-a-mutant-can-tell-from-the-original)). A mutant that does not compile never reaches the triage: the TypeScript checker answers it before any test runs.

An equivalent mutant is declared on the line above it, naming the mutator and why no input can tell it apart:

```ts
// Stryker disable next-line ConditionalExpression: the cache only saves the second read, which returns the same value
```

The reason is the proof, and it is read in review like any other suppression.

## Who may declare

A session triaging by hand declares, and its reviewer accepts or refuses the reason. An agent proposes: it writes the test or the declaration on a branch, and a reviewer accepts it before it lands. An agent declares unattended only once its precision on the vision 17 hand triage reaches 0.95: of the mutants it called equivalent, 95 % or more were declared equivalent by hand ([ADR-029](../decisions/029-a-mutant-is-made-where-it-can-teach-and-judged-by-what-its-code-is.md)). Until that measure is recorded, every agent proposes.

## After the triage

Run `typescript mutation` again: the verdict lists what still survives, and a survivor the triage answered is gone from it. A declaration that turns out wrong is a test away from being found: delete it, and the next run names the mutant again.
