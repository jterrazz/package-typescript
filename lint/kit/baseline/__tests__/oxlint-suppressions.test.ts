import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
    keptAcross,
    OXLINT_SUPPRESSIONS,
    removeWhenEmpty,
    suppressedCount,
    SUPPRESSIONS_LEDGER,
    vanishedEntries,
    withStagedSuppressions,
} from '../oxlint-suppressions.js';

const roots: string[] = [];

afterEach(() => {
    vi.restoreAllMocks();
    for (const root of roots.splice(0)) {
        rmSync(root, { force: true, recursive: true });
    }
});

function projectHolding(ledger: null | string): string {
    const root = mkdtempSync(join(tmpdir(), 'staged-suppressions-'));
    roots.push(root);
    if (ledger !== null) {
        mkdirSync(join(root, '.studio'));
        writeFileSync(join(root, SUPPRESSIONS_LEDGER), ledger);
    }

    return root;
}

describe('oxlint-suppressions', () => {
    test.each([
        ['a ledger', '{"a.ts":{"no-debugger":{"count":1}}}'],
        ['no ledger', null],
    ])(
        'takes the staged file back from the root when a signal ends a run over %s',
        async (_, ledger) => {
            // Given - a project, and a signal raised while oxlint's file is staged at its root
            const root = projectHolding(ledger);
            const raised = vi.spyOn(process, 'kill').mockReturnValue(true);

            // When - Ctrl-C reaches the run, and oxlint has written its file at the root
            const leftAtTheSignal = await withStagedSuppressions(root, async () => {
                writeFileSync(join(root, OXLINT_SUPPRESSIONS), ledger ?? '{"b.ts":{}}');
                process.emit('SIGINT', 'SIGINT');

                return existsSync(join(root, OXLINT_SUPPRESSIONS));
            });

            // Then - the signal took the file back before the process ends, the ledger is what the run left, and the signal is raised again
            expect(leftAtTheSignal).toBe(false);
            expect(existsSync(join(root, OXLINT_SUPPRESSIONS))).toBe(false);
            expect(readFileSync(join(root, SUPPRESSIONS_LEDGER), 'utf8')).toBe(
                ledger ?? '{"b.ts":{}}',
            );
            expect(raised).toHaveBeenCalledWith(process.pid, 'SIGINT');
        },
    );

    test('lays the ledger at the root for the run, under the name oxlint reads', async () => {
        // Given - a project whose ledger holds one rule
        const root = projectHolding('{"a.ts":{"no-debugger":{"count":1}}}');

        // When - a run reads the root
        const seen = await withStagedSuppressions(root, async () => {
            await Promise.resolve();
            return readFileSync(join(root, OXLINT_SUPPRESSIONS), 'utf8');
        });

        // Then - the run found the ledger there, and it is back in place after
        expect([seen, readFileSync(join(root, SUPPRESSIONS_LEDGER), 'utf8')]).toStrictEqual([
            '{"a.ts":{"no-debugger":{"count":1}}}',
            '{"a.ts":{"no-debugger":{"count":1}}}',
        ]);
    });

    test('a run that leaves no file at the root leaves no ledger', async () => {
        // Given - a project with a ledger, and a run after which oxlint held nothing
        const root = projectHolding('{"a.ts":{"no-debugger":{"count":1}}}');

        // When - the run removes the staged file
        await withStagedSuppressions(root, async () => {
            await Promise.resolve();
            rmSync(join(root, OXLINT_SUPPRESSIONS));
        });

        // Then - the ledger at zero is no file
        expect(existsSync(join(root, SUPPRESSIONS_LEDGER))).toBe(false);
    });

    test('keptAcross — puts back the file a run rewrote, and removes the one it created', async () => {
        // Given - a project holding oxlint's file, and one that holds none
        const holding = projectHolding(null);
        writeFileSync(join(holding, OXLINT_SUPPRESSIONS), '{"kept.ts":{}}');
        const bare = projectHolding(null);

        // When - a run rewrites the first and writes the second
        await keptAcross(holding, async () => {
            await Promise.resolve();
            writeFileSync(join(holding, OXLINT_SUPPRESSIONS), '{"rewritten.ts":{}}');
        });
        await keptAcross(bare, async () => {
            await Promise.resolve();
            writeFileSync(join(bare, OXLINT_SUPPRESSIONS), '{"created.ts":{}}');
        });

        // Then - the first reads as before the run, the second is not there
        expect(readFileSync(join(holding, OXLINT_SUPPRESSIONS), 'utf8')).toBe('{"kept.ts":{}}');
        expect(existsSync(join(bare, OXLINT_SUPPRESSIONS))).toBe(false);
    });

    test('keptAcross — is the value of the run, and leaves the file back when the run throws', async () => {
        // Given - a project holding oxlint's file
        const root = projectHolding(null);
        writeFileSync(join(root, OXLINT_SUPPRESSIONS), 'held');

        // When - a run throws after rewriting it
        const failed = keptAcross(root, async () => {
            await Promise.resolve();
            writeFileSync(join(root, OXLINT_SUPPRESSIONS), 'rewritten');
            throw new Error('the run failed');
        });

        // Then - the error reaches the caller, and the file is as held; a run that returns hands back its value
        await expect(failed).rejects.toThrow('the run failed');
        expect(readFileSync(join(root, OXLINT_SUPPRESSIONS), 'utf8')).toBe('held');
        const returned = await keptAcross(root, async () => {
            await Promise.resolve();

            return 7;
        });
        expect(returned).toBe(7);
    });

    test.each([
        ['an empty file', '{}', false],
        ['one entry counting nothing', '{"a.ts":{"no-debugger":{"count":0}}}', false],
        ['one entry counting one', '{"a.ts":{"no-debugger":{"count":1}}}', true],
    ])('removeWhenEmpty — over %s, removes the file: %s', (_, content, kept) => {
        // Given - a project holding oxlint's file
        const root = projectHolding(null);
        writeFileSync(join(root, OXLINT_SUPPRESSIONS), content);

        // When - the file is removed where it is empty
        removeWhenEmpty(root);

        // Then - only a file that suppresses something stays
        expect(existsSync(join(root, OXLINT_SUPPRESSIONS))).toBe(kept);
    });

    test('removeWhenEmpty — leaves a project with no file, and a file it cannot read, as they are', () => {
        // Given - a project with no file, and one whose file is not JSON
        const bare = projectHolding(null);
        const broken = projectHolding(null);
        writeFileSync(join(broken, OXLINT_SUPPRESSIONS), 'not json');

        // When - both are swept
        removeWhenEmpty(bare);
        removeWhenEmpty(broken);

        // Then - nothing was made, nothing was removed
        expect(existsSync(join(bare, OXLINT_SUPPRESSIONS))).toBe(false);
        expect(readFileSync(join(broken, OXLINT_SUPPRESSIONS), 'utf8')).toBe('not json');
    });

    test('suppressedCount — sums the counts of every rule of every file, and counts nothing of an entry with none', () => {
        // Given - two files, one rule counting 2 and 3, one rule that holds no count
        const root = projectHolding(null);
        writeFileSync(
            join(root, OXLINT_SUPPRESSIONS),
            JSON.stringify({
                'a.ts': { 'no-debugger': { count: 2 }, 'no-console': { count: 3 } },
                'b.ts': { 'no-alert': {} },
            }),
        );

        // Then - their sum, and null where there is no file or it is no JSON
        expect(suppressedCount(root)).toBe(5);
        expect(suppressedCount(projectHolding(null))).toBeNull();
    });

    test('vanishedEntries — names the files of the file that the project no longer holds', () => {
        // Given - a file suppressing two paths, one of which exists
        const root = projectHolding(null);
        writeFileSync(join(root, 'here.ts'), '');
        writeFileSync(
            join(root, OXLINT_SUPPRESSIONS),
            JSON.stringify({ 'gone.ts': {}, 'here.ts': {} }),
        );

        // Then - the one that is gone; and nothing for a project with no file or one that is not JSON
        expect(vanishedEntries(root)).toStrictEqual(['gone.ts']);
        expect(vanishedEntries(projectHolding(null))).toStrictEqual([]);
    });
});
