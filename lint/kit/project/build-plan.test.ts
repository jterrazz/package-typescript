import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { conventionsOf } from './build-plan.js';

function tree(files: readonly string[]): string {
    const root = mkdtempSync(join(tmpdir(), 'build-plan-'));
    for (const file of files) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        writeFileSync(join(root, file), '');
    }

    return root;
}

describe('build-plan', () => {
    test('conventionsOf — builds each module named for how it is loaded, and the repository’s own commands and self entries apart', () => {
        // Given - the three shipped names, two commands, the root modules of lint/self/, files that are no module, and the same names where none is read
        const root = tree([
            'src/instrumentation.ts',
            'src/pool/xlsx.worker.ts',
            'src/runs/temp-root.global-setup.ts',
            'src/runs/temp-root.global-setup.test.ts',
            'src/tools/schema.cli.ts',
            'src/_fixtures/stray.worker.ts',
            'src/.cache/stray.global-setup.ts',
            'src/node_modules/stray.worker.ts',
            'src/pool/xlsx.worker.ts.orig',
            'src/legacy-instrumentation.ts',
            'src/index.ts',
            'lint/self/self.cli.ts',
            'lint/self/preset.ts',
            'lint/self/preset.test.ts',
            'lint/self/rules/plugin.ts',
            'lint/self/notes.md',
            'src/tools/schema.json',
            'lint/consumer/rules/rule.ts',
            'specs/cli/_setup/selection.cli.ts',
        ]);

        // Then - the shipped entries under their own names, the repository's under their stems
        expect(conventionsOf(root)).toStrictEqual({
            problem: null,
            settings: {
                dev: {
                    preset: 'lint/self/preset.ts',
                    schema: 'src/tools/schema.cli.ts',
                    self: 'lint/self/self.cli.ts',
                },
                entries: {
                    instrumentation: 'src/instrumentation.ts',
                    'temp-root.global-setup': 'src/runs/temp-root.global-setup.ts',
                    'xlsx.worker': 'src/pool/xlsx.worker.ts',
                },
            },
        });
    });

    test('conventionsOf — refuses two modules built to one name, shipped or not, and reads a tree with no src/ as building nothing', () => {
        // Given - two workers of one name, two commands of one stem, and an empty tree
        const shipped = tree(['src/a/pool.worker.ts', 'src/b/pool.worker.ts']);
        const dev = tree(['src/a/seed.cli.ts', 'lint/self/seed.ts']);
        const empty = tree([]);

        // Then - each collision named with its two sources, nothing built from it
        expect([conventionsOf(shipped), conventionsOf(dev), conventionsOf(empty)]).toStrictEqual([
            {
                problem:
                    'holds two modules built as `dist/pool.worker.js`: src/a/pool.worker.ts and src/b/pool.worker.ts — rename one',
                settings: { dev: {}, entries: {} },
            },
            {
                problem:
                    'holds two modules built as `.artifacts/dev/seed.js`: src/a/seed.cli.ts and lint/self/seed.ts — rename one',
                settings: { dev: {}, entries: {} },
            },
            { problem: null, settings: { dev: {}, entries: {} } },
        ]);
    });
});
