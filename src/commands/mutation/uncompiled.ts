import { refusal } from '../../../lint/kit/catalogue/lesson.js';

/** What the run says when Stryker's TypeScript checker stopped it: the tree it mutates does not compile, at the compiler's first error. */
export const uncompiledFound = (diagnostic: string): string =>
    `the tree does not compile before any mutant: ${diagnostic}`;

export const uncompiledRefusal = (diagnostic: string): string =>
    refusal({
        fix: 'make the tree compile, then run again: `typescript check` names every error, in its TypeScript Check pass',
        found: uncompiledFound(diagnostic),
        read: 'docs/reference/quality-checks.md#every-mutant-a-test-runs-is-detected',
        why: 'each mutant is type-checked against the tree it mutates, so a tree the compiler refuses leaves no mutant to judge; the tree must compile before mutants are judged',
    });
