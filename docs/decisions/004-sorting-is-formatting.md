# ADR-004: Sorting is formatting

**Status:** Accepted
**Date:** 2026-09-15

## Context

Import order was a lint rule: `perfectionist/sort-imports`, reached through
oxlint's JS-plugin bridge. oxfmt 0.68 sorts imports itself (`sortImports`),
sorts `package.json` keys (`sortPackageJson`) and sorts Tailwind classes
(`sortTailwindcss`), all three as part of formatting.

Two tools that rewrite the same bytes eventually disagree, and the loser is
whoever runs second. The estate already carries two reasoned `off`s of exactly
that shape — `unicorn/number-literal-case` and `unicorn/no-nested-ternary`, both
of whose fixers ping-pong with the formatter.

## Decision

The formatter owns every order. oxfmt's three sorters are on in the shared
preset, and perfectionist keeps only what oxfmt does not sort — proved per rule,
by running oxfmt on a fixture rather than by reading its documentation.

Measured against oxfmt 0.68: `sortImports` reorders import STATEMENTS and leaves
the named specifiers inside one statement alone, and it touches no type union,
no JSX attribute and no heritage clause. So perfectionist keeps six rules —
union types, intersection types, JSX props, heritage clauses, named imports,
named exports — and `perfectionist/sort-imports` is off, reason `formatter`.

`fixpoint.test.ts` is the general form of the claim: per profile,
`oxlint --fix` then `oxfmt`, twice, must land on the same bytes with no
diagnostic left.

## Consequences

- One test replaces every "does rule X fight the formatter" question, and
  catches the next one before a consumer does.
- Import order now changes on save, in the editor, with no JS-plugin toll.
- The grouping is oxfmt's vocabulary, not perfectionist's. It is close, not
  identical: `internal` and `subpath` are one group there.
- oxfmt's sorter cannot resolve tsconfig path aliases. A project with an alias
  outside `~/`, `@/` and `#` states it in `internalPattern`.
