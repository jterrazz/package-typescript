import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
    OXLINT_SUPPRESSIONS,
    SUPPRESSIONS_LEDGER,
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
        mkdirSync(join(root, '.jterrazz'));
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
});
