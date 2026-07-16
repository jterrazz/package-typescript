import { resolve } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';

import { oxlintSpec } from '../../../setup/oxlint.specification.js';

const ROOT_DIR = resolve(import.meta.dirname, '../../../..');
const BASE_CONFIG = resolve(ROOT_DIR, 'presets/oxlint/base.js');
const NODE_CONFIG = resolve(ROOT_DIR, 'presets/oxlint/node.js');
const EXPO_CONFIG = resolve(ROOT_DIR, 'presets/oxlint/expo.js');
const NEXT_CONFIG = resolve(ROOT_DIR, 'presets/oxlint/next.js');
const VALID_DIR = resolve(import.meta.dirname, 'valid');
const INVALID_DIR = resolve(import.meta.dirname, 'invalid');

describe('linter', () => {
    let baseResult: any;
    let nodeResult: any;
    let expoResult: any;
    let nextResult: any;

    beforeAll(async () => {
        // Given — run oxlint once per config on fixture dirs (absolute paths for JS plugin resolution)
        [baseResult, nodeResult, expoResult, nextResult] = await Promise.all([
            oxlintSpec('base').exec(`-c ${BASE_CONFIG} ${VALID_DIR} ${INVALID_DIR}`).run(),
            oxlintSpec('node').exec(`-c ${NODE_CONFIG} ${VALID_DIR} ${INVALID_DIR}`).run(),
            oxlintSpec('expo').exec(`-c ${EXPO_CONFIG} ${VALID_DIR} ${INVALID_DIR}`).run(),
            oxlintSpec('next').exec(`-c ${NEXT_CONFIG} ${VALID_DIR} ${INVALID_DIR}`).run(),
        ]);
    });

    describe('base config', () => {
        test('detects unused variables', () => {
            // Then — rule triggers on invalid file
            expect(baseResult.grep('invalid/unused-var.ts')).toContain('no-unused-vars');
        });

        test('requires type imports for type-only imports', () => {
            // Then — error on wrong import, pass on correct one
            expect(baseResult.grep('invalid/type-import.ts')).toContain('consistent-type-imports');
            expect(baseResult.grep('/valid/type-import.ts')).not.toContain(
                'consistent-type-imports',
            );
        });

        test('detects unused expressions', () => {
            // Then — unused expression detected
            expect(baseResult.grep('invalid/unused-expression.ts')).toContain(
                'no-unused-expressions',
            );
        });

        test('detects unsorted imports', () => {
            // Then — error on unsorted, pass on sorted
            expect(baseResult.grep('invalid/unsorted-imports.ts')).toContain('sort-imports');
            expect(baseResult.grep('valid/sorted.ts')).not.toContain('sort-imports');
        });

        test('detects unsorted union types', () => {
            // Then — error on unsorted, pass on sorted
            expect(baseResult.grep('invalid/unsorted-union.ts')).toContain('sort-union-types');
            expect(baseResult.grep('valid/sorted-union.ts')).not.toContain('sort-union-types');
        });

        test('detects unsorted named exports', () => {
            // Then — error on unsorted, pass on sorted
            expect(baseResult.grep('invalid/unsorted-named-exports.ts')).toContain(
                'sort-named-exports',
            );
            expect(baseResult.grep('valid/sorted-named-exports.ts')).not.toContain(
                'sort-named-exports',
            );
        });

        test('warns about spread in reduce accumulator', () => {
            // Then — perf rule triggers
            expect(baseResult.grep('invalid/perf-spread-in-accumulator.ts')).toContain(
                'no-accumulating-spread',
            );
        });

        test('allows default exports', () => {
            // Then — no-default-export rule is not active
            expect(baseResult.grep('invalid/default-export.ts')).not.toContain('no-default-export');
            expect(baseResult.grep('valid/named-export.ts')).not.toContain('no-default-export');
        });

        test('rejects imports not at top', () => {
            // Then — import/first rule triggers
            expect(baseResult.grep('invalid/import-not-first.ts')).toContain('first');
        });

        test('rejects namespace imports', () => {
            // Then — no-namespace rule triggers
            expect(baseResult.grep('invalid/namespace-import.ts')).toContain('no-namespace');
        });

        test('requires error variable named error', () => {
            // Then — catch-error-name rule triggers
            expect(baseResult.grep('invalid/catch-error-name.ts')).toContain('catch-error-name');
        });

        test('requires numeric separators on large numbers', () => {
            // Then — numeric separators rule triggers
            expect(baseResult.grep('invalid/numeric-separators.ts')).toContain(
                'numeric-separators',
            );
        });

        test('rejects nested ternary', () => {
            // Then — nested-ternary rule triggers
            expect(baseResult.grep('invalid/nested-ternary.ts')).toContain('nested-ternary');
        });

        test('requires curly braces', () => {
            // Then — curly rule triggers
            expect(baseResult.grep('invalid/curly.ts')).toContain('curly');
        });

        test('warns about lowercase comments', () => {
            // Then — capitalized-comments rule triggers
            expect(baseResult.grep('invalid/capitalized-comment.ts')).toContain(
                'capitalized-comments',
            );
        });

        describe('disabled rules', () => {
            test('allows lowercase constructor names (new-cap disabled)', () => {
                // Then — new-cap does NOT trigger
                expect(baseResult.grep('valid/new-cap.ts')).not.toContain('new-cap');
            });

            test('allows unassigned imports (no-unassigned-import disabled)', () => {
                // Then — rule does NOT trigger
                expect(baseResult.grep('valid/unassigned-import.ts')).not.toContain(
                    'no-unassigned-import',
                );
            });

            test('allows await in loops (no-await-in-loop disabled)', () => {
                // Then — rule does NOT trigger
                expect(baseResult.grep('valid/await-in-loop.ts')).not.toContain('no-await-in-loop');
            });

            test('allows named default imports (no-named-default disabled)', () => {
                // Then — rule does NOT trigger
                expect(baseResult.grep('valid/named-default.ts')).not.toContain('no-named-default');
            });

            test('allows inferrable type annotations (no-inferrable-types disabled)', () => {
                // Then — rule does NOT trigger
                expect(baseResult.grep('valid/inferrable-types.ts')).not.toContain(
                    'no-inferrable-types',
                );
            });
        });
    });

    describe('node config', () => {
        test('requires .js extension on relative imports', () => {
            // Then — imports-with-ext rule triggers on missing extension
            expect(nodeResult.grep('invalid/missing-js-ext.ts')).toContain('imports-with-ext');
        });

        test('passes when .js extension is present', () => {
            // Then — rule does NOT trigger on valid file
            expect(nodeResult.grep('valid/sorted.ts')).not.toContain('imports-with-ext');
        });

        test('inherits base rules', () => {
            // Then — base rule still works in node config
            expect(nodeResult.grep('invalid/unused-var.ts')).toContain('no-unused-vars');
        });
    });

    describe('expo config', () => {
        test('rejects .ts extension on relative imports', () => {
            // Then — imports-without-ext rule triggers
            expect(expoResult.grep('invalid/has-ts-ext.ts')).toContain('imports-without-ext');
        });

        test('passes when no extension on relative imports', () => {
            // Then — rule does NOT trigger on valid file
            expect(expoResult.grep('valid/sorted-no-ext.ts')).not.toContain('imports-without-ext');
        });

        test('inherits base rules', () => {
            // Then — base rule still works in expo config
            expect(expoResult.grep('invalid/unsorted-imports.ts')).toContain('sort-imports');
        });
    });

    describe('nextjs config', () => {
        test('rejects .ts extension on relative imports', () => {
            // Then — imports-without-ext rule triggers
            expect(nextResult.grep('invalid/has-ts-ext.ts')).toContain('imports-without-ext');
        });

        test('passes when no extension on relative imports', () => {
            // Then — rule does NOT trigger on valid file
            expect(nextResult.grep('valid/sorted-no-ext.ts')).not.toContain('imports-without-ext');
        });

        test('inherits base rules', () => {
            // Then — base rule still works in nextjs config
            expect(nextResult.grep('invalid/unused-var.ts')).toContain('no-unused-vars');
        });
    });
});
