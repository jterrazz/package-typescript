import { describe, expect, test } from 'vitest';

import { dryRunFilesOf } from '../dry-run-files.js';
import type { MutatedSource } from '../dry-run-files.js';
import { observedFrom, ranBy } from '../observed.js';

const LOADED = ['src/b.ts', 'src/cli.ts', 'src/labels.ts'];

const OBSERVED = observedFrom([
    { loaded: LOADED, ran: ['src/cli.ts'], test: 'specs/a.spec.ts#a loads every command' },
    { loaded: LOADED, ran: LOADED, test: 'specs/b.spec.ts#b runs its command' },
    { loaded: [], ran: [], test: 'src/__tests__/x.test.ts#x reads in its own process' },
    { test: 'specs/c.spec.ts#c is not followed' },
]);

const INPUTS = Object.fromEntries(
    [
        'specs/a.spec.ts',
        'specs/b.spec.ts',
        'specs/c.spec.ts',
        'specs/d.spec.ts',
        'src/__tests__/x.test.ts',
        ...LOADED,
        'src/x.ts',
    ].map((path) => [path, 'hash']),
);

const STALENESS = {
    onlyFunctions: (source: string) => source === 'src/b.ts',
    ranBy: ranBy(OBSERVED),
    reach: (file: string) => ({
        everything: false,
        files: new Set(file === 'src/__tests__/x.test.ts' ? ['src/x.ts'] : []),
    }),
};

const keptFor = (
    changed: readonly string[],
    mutated: readonly MutatedSource[],
    inputs: Readonly<Record<string, string>> = INPUTS,
): ReturnType<typeof dryRunFilesOf> =>
    dryRunFilesOf({ changed, inputs, mutated, observed: OBSERVED, staleness: STALENESS });

describe('dry-run-files', () => {
    test('dryRunFilesOf — keeps the files whose tests the change made stale or that reach a mutated source, and every file where the record cannot say', () => {
        // Given - a record of a spec that only loads the commands, one that runs command b, a module test, and a spec the run could not follow

        // When - a function of b.ts changes, a module-level line of labels.ts changes, a spec is added, a spec is deleted, a root config changes, and a change no test reaches
        const outcomes = {
            added: keptFor(['specs/d.spec.ts'], [{ file: 'src/b.ts', inFunctions: true }]),
            deleted: keptFor(
                ['specs/a.spec.ts', 'src/b.ts'],
                [{ file: 'src/b.ts', inFunctions: true }],
                Object.fromEntries(
                    Object.entries(INPUTS).filter(([path]) => path !== 'specs/a.spec.ts'),
                ),
            ),
            inFunction: keptFor(['src/b.ts'], [{ file: 'src/b.ts', inFunctions: true }]),
            inProcess: keptFor(['src/x.ts'], [{ file: 'src/x.ts', inFunctions: true }]),
            moduleLevel: keptFor(
                ['src/labels.ts'],
                [{ file: 'src/labels.ts', inFunctions: false }],
            ),
            noRecord: dryRunFilesOf({
                changed: ['src/b.ts'],
                inputs: INPUTS,
                mutated: [{ file: 'src/b.ts', inFunctions: true }],
                observed: { sets: [], tests: {} },
                staleness: STALENESS,
            }),
            rootConfig: keptFor(['vitest.config.ts'], [{ file: 'src/b.ts', inFunctions: true }]),
        };

        // Then - the spec that only loads b.ts is left out while the change stays in its functions, the unfollowed spec is always kept, a new spec is kept, a deleted one is neither kept nor known, and a root config or an empty record keeps every file
        expect(outcomes).toStrictEqual({
            added: { kept: ['specs/b.spec.ts', 'specs/c.spec.ts', 'specs/d.spec.ts'], known: 4 },
            deleted: { kept: ['specs/b.spec.ts', 'specs/c.spec.ts'], known: 3 },
            inFunction: { kept: ['specs/b.spec.ts', 'specs/c.spec.ts'], known: 4 },
            inProcess: { kept: ['specs/c.spec.ts', 'src/__tests__/x.test.ts'], known: 4 },
            moduleLevel: {
                kept: ['specs/a.spec.ts', 'specs/b.spec.ts', 'specs/c.spec.ts'],
                known: 4,
            },
            noRecord: undefined,
            rootConfig: undefined,
        });
    });

    test('dryRunFilesOf — a test reaching any one of the mutated sources is kept, a spec that only loads a source is kept where a line mutated there loads, and a run that keeps no file runs every file', () => {
        // Given - the same record, nothing changed since it was written
        const followed = Object.fromEntries(
            Object.entries(INPUTS).filter(([path]) => path !== 'specs/c.spec.ts'),
        );

        // When - two sources are mutated inside their functions, a module-level line of labels.ts is mutated, a spec is added to a record of no test, and a mutated source no followed test reaches
        const outcomes = {
            addedToNoRecord: dryRunFilesOf({
                changed: ['specs/d.spec.ts'],
                inputs: INPUTS,
                mutated: [{ file: 'src/b.ts', inFunctions: true }],
                observed: { sets: [], tests: {} },
                staleness: STALENESS,
            }),
            moduleLevel: keptFor([], [{ file: 'src/labels.ts', inFunctions: false }]),
            twoSources: keptFor(
                [],
                [
                    { file: 'src/b.ts', inFunctions: true },
                    { file: 'src/x.ts', inFunctions: true },
                ],
            ),
            unreached: keptFor([], [{ file: 'src/z.ts', inFunctions: true }], followed),
        };

        // Then - each test reaching one of the two is kept, the spec that loads labels.ts too, and a record of no test or a dry run of no file reads as every file
        expect(outcomes).toStrictEqual({
            addedToNoRecord: undefined,
            moduleLevel: {
                kept: ['specs/a.spec.ts', 'specs/b.spec.ts', 'specs/c.spec.ts'],
                known: 4,
            },
            twoSources: {
                kept: ['specs/b.spec.ts', 'specs/c.spec.ts', 'src/__tests__/x.test.ts'],
                known: 4,
            },
            unreached: undefined,
        });
    });
});
