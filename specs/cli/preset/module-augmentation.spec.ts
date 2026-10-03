import { describe, expect, test } from 'vitest';

import { diagnosticsOf, oxlint, sandbox } from './_setup/rulebook.js';

// `export {}` is what makes a `declare module` file an augmentation rather than an ambient redeclaration.

const FIXTURE = new URL('_fixtures/augmentation/', import.meta.url).pathname;

function rulesOn(file: string): string[] {
    using work = sandbox(FIXTURE, 'node', 'node');
    const report = oxlint(work.path, ['-c', work.config, '--format=json', file]);

    return diagnosticsOf(report).map((diagnostic) => diagnostic.code);
}

describe('module-augmentation', () => {
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
});
