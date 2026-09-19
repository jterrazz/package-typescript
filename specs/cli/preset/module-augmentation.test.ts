import { expect, test } from 'vitest';

import { diagnosticsOf, oxlint, sandbox } from './rulebook.js';

/*
 * Module augmentation, held against the two rules that rewrite its shape.
 *
 * An augmentation merges into an existing declaration only as an INTERFACE: a
 * `type` alias redeclares the name and every member of the original is lost.
 * And `export {}` is what makes a file carrying `declare module` an
 * augmentation rather than an ambient redeclaration of the module — dropping
 * it changes what the block means.
 *
 * A declaration file is where augmentation lives, so `consistent-type-definitions`
 * is off there and on everywhere else, where a human answers it with a
 * suppression inside the block. The rulebook is the product here, so the suite
 * drives oxlint directly, the B9w exception `oxlint.specification.ts` states.
 */

const FIXTURE = new URL('_fixtures/augmentation/', import.meta.url).pathname;

/** The rule ids one file's diagnostics name, in oxlint's own vocabulary. */
function rulesOn(file: string): string[] {
    using work = sandbox(FIXTURE, 'library', 'library');
    const report = oxlint(work.path, ['-c', work.config, '--format=json', file]);

    return diagnosticsOf(report).map((diagnostic) => diagnostic.code);
}

test('a declaration file keeps its interfaces — only an interface merges', () => {
    // Given - a .d.ts whose `declare module` block augments a library
    // When - the rulebook judges it
    const rules = rulesOn('augment.d.ts');

    // Then - the interface is never asked to become a type alias
    expect(rules).not.toContain('typescript(consistent-type-definitions)');
});

test('an augmentation outside a declaration file is still reported, for a human', () => {
    // Given - the same block in an ordinary .ts file
    // When - the rulebook judges it
    const rules = rulesOn('augment.ts');

    // Then - the rule is armed there, and its fixer is the one `fix` never runs
    expect(rules).toContain('typescript(consistent-type-definitions)');
});

test('the `export {}` that makes a block an augmentation is never called useless', () => {
    // Given - both files, each carrying `declare module` and nothing else exported
    // When - the rulebook judges them
    const rules = [...rulesOn('augment.d.ts'), ...rulesOn('augment.ts')];

    // Then - no rule asks for the one statement that decides what the block means
    expect(rules).not.toContain('typescript(no-useless-empty-export)');
});
