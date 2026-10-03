import { describe, expect, test } from 'vitest';

import { compile, merge } from './compile.js';
import { fragment, off, on, scoped } from './decision.js';

describe('compile', () => {
    test('concatenates and dedupes plugin lists', () => {
        // Given - two configs sharing one jsPlugin
        const merged = merge(
            { jsPlugins: ['a', 'b'], plugins: ['typescript'] },
            { jsPlugins: ['b', 'c'], plugins: ['typescript', 'import'] },
        );

        // Then - order preserved, duplicates dropped
        expect(merged.jsPlugins).toStrictEqual(['a', 'b', 'c']);
        expect(merged.plugins).toStrictEqual(['typescript', 'import']);
    });

    test('shallow-merges rules with the last config winning', () => {
        // Given - two configs disagreeing on one rule
        const merged = merge(
            { rules: { curly: 'error', 'no-ternary': 'off' } },
            { rules: { curly: 'off', 'jterrazz/given-and-then-markers-present': 'error' } },
        );

        // Then - the later config wins per key, others survive
        expect(merged.rules).toStrictEqual({
            curly: 'off',
            'jterrazz/given-and-then-markers-present': 'error',
            'no-ternary': 'off',
        });
    });

    test('concatenates overrides in order without deduping', () => {
        // Given - two configs each shipping an override
        const first = { files: ['**/*.specification.ts'], rules: {} };
        const second = { files: ['src/**'], rules: {} };
        const merged = merge({ overrides: [first] }, { overrides: [second] });

        // Then - both overrides survive, in composition order
        expect(merged.overrides).toStrictEqual([first, second]);
    });

    test('concatenates and dedupes ignorePatterns', () => {
        // Given - overlapping ignore lists
        const merged = merge(
            { ignorePatterns: ['dist/**', 'node_modules/**'] },
            { ignorePatterns: ['node_modules/**', '**/_fixtures/**'] },
        );

        // Then - one entry each
        expect(merged.ignorePatterns).toStrictEqual([
            'dist/**',
            'node_modules/**',
            '**/_fixtures/**',
        ]);
    });

    test('takes a key the merge tables do not name from the last config that sets it, whole', () => {
        // Given - configs disagreeing on `categories`, a key the merge tables leave out, then one leaving it unset
        const merged = merge(
            { categories: { correctness: 'off', style: 'off' } },
            { categories: { correctness: 'error' } },
            // @ts-expect-error -- a JavaScript config can leave a key unset, which the type cannot spell
            { categories: undefined },
        );

        // Then - the last that sets it wins, never merged, and an unset key takes nothing
        expect(merged).toStrictEqual({ categories: { correctness: 'error' } });
    });

    test('compiles an empty fragment to its rules alone', () => {
        // Given - a fragment that declares nothing but its name
        // Then - no list and no table is written for what it does not declare
        expect(compile(fragment({ audience: 'consumer', id: 'empty' }))).toStrictEqual({
            rules: {},
        });
    });

    test('compiles every part a fragment declares, a JS plugin by the path it is handed', () => {
        // Given - a fragment declaring each part, with a rule taking a list of options and one taking an object
        const probe = fragment({
            audience: 'consumer',
            env: { browser: true },
            globals: { React: 'readonly' },
            id: 'probe',
            ignorePatterns: ['dist/**'],
            jsPlugins: ['jterrazz', './local.mjs'],
            options: { reportUnusedDisableDirectives: 'error' },
            overrides: [
                scoped({ files: ['*.js'], rules: { curly: off({ by: 'js', kind: 'covered' }) } }),
            ],
            plugins: ['typescript'],
            rules: {
                'max-depth': on([4]),
                'no-restricted-imports': on({ paths: ['lodash'] }),
            },
            settings: { react: { version: '19' } },
        });

        // Then - each part lands under its key, the named plugin resolved, the unnamed one kept
        expect(compile(probe, { jterrazz: '/abs/plugin.js' })).toStrictEqual({
            env: { browser: true },
            globals: { React: 'readonly' },
            ignorePatterns: ['dist/**'],
            jsPlugins: ['/abs/plugin.js', './local.mjs'],
            options: { reportUnusedDisableDirectives: 'error' },
            overrides: [{ files: ['*.js'], rules: { curly: 'off' } }],
            plugins: ['typescript'],
            rules: {
                'max-depth': ['error', 4],
                'no-restricted-imports': ['error', { paths: ['lodash'] }],
            },
            settings: { react: { version: '19' } },
        });
    });

    test('ignores null and undefined configs', () => {
        // Given - a composition with holes (a conditional fragment)
        const merged = merge(
            // @ts-expect-error - a conditional fragment is undefined at runtime, which the merge must survive
            undefined,
            { rules: { curly: 'error' } },
            null,
        );

        // Then - the holes contribute nothing
        expect(merged.rules).toStrictEqual({ curly: 'error' });
    });
});
