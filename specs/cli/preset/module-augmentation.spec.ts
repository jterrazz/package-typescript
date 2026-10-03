import { describe, expect, test } from 'vitest';

import { diagnosticsOf, oxlint, sandbox } from './_setup/rulebook.js';

const FIXTURE = new URL('_fixtures/augmentation/', import.meta.url).pathname;

function rulesOn(file: string): string[] {
    using work = sandbox(FIXTURE, 'node', 'node');
    const report = oxlint(work.path, ['-c', work.config, '--format=json', file]);

    return diagnosticsOf(report).map((diagnostic) => diagnostic.code);
}

describe('module-augmentation', () => {
    test('the `export {}` that makes a block an augmentation is never called useless', () => {
        // Given - both files, each carrying `declare module` and nothing else exported
        // When - the rulebook judges them
        const rules = [...rulesOn('augment.d.ts'), ...rulesOn('augment.ts')];

        // Then - no rule asks for the one statement that decides what the block means
        expect(rules).not.toContain('typescript(no-useless-empty-export)');
    });
});
