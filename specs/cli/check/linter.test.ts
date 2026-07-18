import { resolve } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';

import { cli as oxlintCli } from '../oxlint.specification.js';

const PRESETS = resolve(import.meta.dirname, '../../../presets/oxlint');
const BASE_CONFIG = resolve(PRESETS, 'base.js');
const NODE_CONFIG = resolve(PRESETS, 'node.js');
const EXPO_CONFIG = resolve(PRESETS, 'expo.js');
const NEXT_CONFIG = resolve(PRESETS, 'next.js');

type LintResult = Awaited<ReturnType<typeof oxlintCli.exec>>;

// Stage the valid/ and invalid/ case trees in the cwd, then lint them with one config.
// Grep is the scalpel here: each rule is a targeted presence/absence probe in the
// Combined lint output, not a full-surface snapshot.
function lintWith(config: string): Promise<LintResult> {
    return oxlintCli
        .fixture('linter/valid')
        .fixture('linter/invalid')
        .exec(`-c ${config} valid invalid`);
}

describe('base config', () => {
    let baseResult: LintResult;

    beforeAll(async () => {
        baseResult = await lintWith(BASE_CONFIG);
    });

    test('detects unused variables', () => {
        // Given - the base config linting the case trees
        // Then - the rule triggers on the invalid file
        expect(baseResult.stdout.grep('invalid/unused-var.ts')).toContain('no-unused-vars');
    });

    test('requires type imports for type-only imports', () => {
        // Given - the base config linting the case trees
        // Then - it errors on the wrong import and passes on the correct one
        expect(baseResult.stdout.grep('invalid/type-import.ts')).toContain(
            'consistent-type-imports',
        );
        expect(baseResult.stdout.grep('/valid/type-import.ts')).not.toContain(
            'consistent-type-imports',
        );
    });

    test('detects unused expressions', () => {
        // Given - the base config linting the case trees
        // Then - the unused expression is detected
        expect(baseResult.stdout.grep('invalid/unused-expression.ts')).toContain(
            'no-unused-expressions',
        );
    });

    test('detects unsorted imports', () => {
        // Given - the base config linting the case trees
        // Then - it errors on unsorted and passes on sorted
        expect(baseResult.stdout.grep('invalid/unsorted-imports.ts')).toContain('sort-imports');
        expect(baseResult.stdout.grep('valid/sorted.ts')).not.toContain('sort-imports');
    });

    test('detects unsorted union types', () => {
        // Given - the base config linting the case trees
        // Then - it errors on unsorted and passes on sorted
        expect(baseResult.stdout.grep('invalid/unsorted-union.ts')).toContain('sort-union-types');
        expect(baseResult.stdout.grep('valid/sorted-union.ts')).not.toContain('sort-union-types');
    });

    test('detects unsorted named exports', () => {
        // Given - the base config linting the case trees
        // Then - it errors on unsorted and passes on sorted
        expect(baseResult.stdout.grep('invalid/unsorted-named-exports.ts')).toContain(
            'sort-named-exports',
        );
        expect(baseResult.stdout.grep('valid/sorted-named-exports.ts')).not.toContain(
            'sort-named-exports',
        );
    });

    test('warns about spread in reduce accumulator', () => {
        // Given - the base config linting the case trees
        // Then - the perf rule triggers
        expect(baseResult.stdout.grep('invalid/perf-spread-in-accumulator.ts')).toContain(
            'no-accumulating-spread',
        );
    });

    test('allows default exports', () => {
        // Given - the base config linting the case trees
        // Then - the no-default-export rule is not active
        expect(baseResult.stdout.grep('invalid/default-export.ts')).not.toContain(
            'no-default-export',
        );
        expect(baseResult.stdout.grep('valid/named-export.ts')).not.toContain('no-default-export');
    });

    test('rejects imports not at the top', () => {
        // Given - the base config linting the case trees
        // Then - the import/first rule triggers
        expect(baseResult.stdout.grep('invalid/import-not-first.ts')).toContain('first');
    });

    test('rejects namespace imports', () => {
        // Given - the base config linting the case trees
        // Then - the no-namespace rule triggers
        expect(baseResult.stdout.grep('invalid/namespace-import.ts')).toContain('no-namespace');
    });

    test('requires the error variable named error', () => {
        // Given - the base config linting the case trees
        // Then - the catch-error-name rule triggers
        expect(baseResult.stdout.grep('invalid/catch-error-name.ts')).toContain('catch-error-name');
    });

    test('requires numeric separators on large numbers', () => {
        // Given - the base config linting the case trees
        // Then - the numeric separators rule triggers
        expect(baseResult.stdout.grep('invalid/numeric-separators.ts')).toContain(
            'numeric-separators',
        );
    });

    test('rejects nested ternaries', () => {
        // Given - the base config linting the case trees
        // Then - the nested-ternary rule triggers
        expect(baseResult.stdout.grep('invalid/nested-ternary.ts')).toContain('nested-ternary');
    });

    test('requires curly braces', () => {
        // Given - the base config linting the case trees
        // Then - the curly rule triggers
        expect(baseResult.stdout.grep('invalid/curly.ts')).toContain('curly');
    });

    test('warns about lowercase comments', () => {
        // Given - the base config linting the case trees
        // Then - the capitalized-comments rule triggers
        expect(baseResult.stdout.grep('invalid/capitalized-comment.ts')).toContain(
            'capitalized-comments',
        );
    });

    test('allows lowercase constructor names', () => {
        // Given - the base config linting the case trees
        // Then - new-cap does not trigger (rule disabled)
        expect(baseResult.stdout.grep('valid/new-cap.ts')).not.toContain('new-cap');
    });

    test('allows unassigned imports', () => {
        // Given - the base config linting the case trees
        // Then - no-unassigned-import does not trigger (rule disabled)
        expect(baseResult.stdout.grep('valid/unassigned-import.ts')).not.toContain(
            'no-unassigned-import',
        );
    });

    test('allows await in loops', () => {
        // Given - the base config linting the case trees
        // Then - no-await-in-loop does not trigger (rule disabled)
        expect(baseResult.stdout.grep('valid/await-in-loop.ts')).not.toContain('no-await-in-loop');
    });

    test('allows named default imports', () => {
        // Given - the base config linting the case trees
        // Then - no-named-default does not trigger (rule disabled)
        expect(baseResult.stdout.grep('valid/named-default.ts')).not.toContain('no-named-default');
    });

    test('allows inferrable type annotations', () => {
        // Given - the base config linting the case trees
        // Then - no-inferrable-types does not trigger (rule disabled)
        expect(baseResult.stdout.grep('valid/inferrable-types.ts')).not.toContain(
            'no-inferrable-types',
        );
    });
});

describe('node config', () => {
    let nodeResult: LintResult;

    beforeAll(async () => {
        nodeResult = await lintWith(NODE_CONFIG);
    });

    test('requires a .js extension on relative imports', () => {
        // Given - the node config linting the case trees
        // Then - imports-with-ext triggers on a missing extension
        expect(nodeResult.stdout.grep('invalid/missing-js-ext.ts')).toContain('imports-with-ext');
    });

    test('passes when the .js extension is present', () => {
        // Given - the node config linting the case trees
        // Then - the rule does not trigger on a valid file
        expect(nodeResult.stdout.grep('valid/sorted.ts')).not.toContain('imports-with-ext');
    });

    test('inherits base rules under the node config', () => {
        // Given - the node config linting the case trees
        // Then - a base rule still fires
        expect(nodeResult.stdout.grep('invalid/unused-var.ts')).toContain('no-unused-vars');
    });
});

describe('expo config', () => {
    let expoResult: LintResult;

    beforeAll(async () => {
        expoResult = await lintWith(EXPO_CONFIG);
    });

    test('rejects a .ts extension on relative imports under expo', () => {
        // Given - the expo config linting the case trees
        // Then - imports-without-ext triggers
        expect(expoResult.stdout.grep('invalid/has-ts-ext.ts')).toContain('imports-without-ext');
    });

    test('passes when no extension is present under expo', () => {
        // Given - the expo config linting the case trees
        // Then - the rule does not trigger on a valid file
        expect(expoResult.stdout.grep('valid/sorted-no-ext.ts')).not.toContain(
            'imports-without-ext',
        );
    });

    test('inherits base rules under the expo config', () => {
        // Given - the expo config linting the case trees
        // Then - a base rule still fires
        expect(expoResult.stdout.grep('invalid/unsorted-imports.ts')).toContain('sort-imports');
    });
});

describe('nextjs config', () => {
    let nextResult: LintResult;

    beforeAll(async () => {
        nextResult = await lintWith(NEXT_CONFIG);
    });

    test('rejects a .ts extension on relative imports under nextjs', () => {
        // Given - the nextjs config linting the case trees
        // Then - imports-without-ext triggers
        expect(nextResult.stdout.grep('invalid/has-ts-ext.ts')).toContain('imports-without-ext');
    });

    test('passes when no extension is present under nextjs', () => {
        // Given - the nextjs config linting the case trees
        // Then - the rule does not trigger on a valid file
        expect(nextResult.stdout.grep('valid/sorted-no-ext.ts')).not.toContain(
            'imports-without-ext',
        );
    });

    test('inherits base rules under the nextjs config', () => {
        // Given - the nextjs config linting the case trees
        // Then - a base rule still fires
        expect(nextResult.stdout.grep('invalid/unused-var.ts')).toContain('no-unused-vars');
    });
});
