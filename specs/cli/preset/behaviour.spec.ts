import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { diagnosticsOf, oxlint, PROFILES, sandbox } from './_setup/rulebook.js';
import type { Diagnostic } from './_setup/rulebook.js';

const BUILT_FROM = resolve(import.meta.dirname, '../../..');

// One case per decision this package owns, never per upstream rule. The `_expected/` tree holds only the files
// `--fix` rewrote, so a reasoned `off` states itself by absence. Regenerate with `TEST_UPDATE=1 npm test`.

const FIXTURES = resolve(import.meta.dirname, '_fixtures/behaviour');
const EXPECTED = resolve(import.meta.dirname, '_expected/behaviour');
const UPDATING = process.env.TEST_UPDATE === '1';

function rulesOf(diagnostics: Diagnostic[]): string {
    const lines = diagnostics
        .filter((diagnostic) => diagnostic.severity === 'error')
        .map(({ code, filename, labels }) => {
            const { column = 0, line = 0 } = labels[0]?.span ?? {};

            return `${filename}:${line}:${column} ${code}`;
        });
    return `${lines.toSorted((left, right) => left.localeCompare(right)).join('\n')}\n`;
}

describe('behaviour', () => {
    test.each(PROFILES)(
        '$name fixes what it owns and says what it refuses',
        ({ name, tsconfig }) => {
            // Given - a tree breaking one decision per line, fixed once
            const input = resolve(FIXTURES, name, 'input');
            using work = sandbox(input, name, tsconfig);
            oxlint(work.path, ['-c', work.config, '--fix', ...work.files]);

            // Then - every file the fixer rewrote matches its golden, and no other file is committed
            const tree = resolve(EXPECTED, name);
            const rewritten = work.files.filter(
                (file) =>
                    readFileSync(resolve(work.path, file), 'utf8') !==
                    readFileSync(resolve(input, file), 'utf8'),
            );

            if (UPDATING) {
                rmSync(tree, { force: true, recursive: true });
                if (rewritten.length > 0) {
                    mkdirSync(tree, { recursive: true });
                }
                for (const file of rewritten) {
                    writeFileSync(
                        resolve(tree, file),
                        readFileSync(resolve(work.path, file), 'utf8'),
                    );
                }
            }

            expect(existsSync(tree) ? readdirSync(tree).toSorted() : []).toStrictEqual(
                rewritten.toSorted(),
            );
            for (const file of rewritten) {
                expect
                    .soft(readFileSync(resolve(work.path, file), 'utf8'), `${name}/${file}`)
                    .toBe(readFileSync(resolve(tree, file), 'utf8'));
            }

            // Then - what the fixer cannot repair is exactly the report the golden records
            const golden = resolve(EXPECTED, `${name}.report.txt`);
            const report = rulesOf(
                diagnosticsOf(
                    oxlint(work.path, ['-c', work.config, '--format=json', ...work.files]),
                ),
            );
            if (UPDATING) {
                writeFileSync(golden, report);
            }
            expect(report).toBe(readFileSync(golden, 'utf8'));
        },
    );

    test('keeps a behaviour or fixpoint ground only for a profile the rulebook ships', () => {
        // Given - every entry of the behaviour goldens and of the behaviour and fixpoint fixtures
        const owners = new Set<string>(PROFILES.map(({ name }) => name));
        const entries = [
            ...readdirSync(EXPECTED).map((entry) => `_expected/behaviour/${entry}`),
            ...readdirSync(FIXTURES).map((entry) => `_fixtures/behaviour/${entry}`),
            ...readdirSync(resolve(import.meta.dirname, '_fixtures/fixpoint')).map(
                (entry) => `_fixtures/fixpoint/${entry}`,
            ),
        ];

        // Then - each one is named for a shipped profile, and none outlives one
        const orphans = entries.filter(
            (entry) => !owners.has((entry.split('/').at(-1) ?? '').replace(/\.report\.txt$/u, '')),
        );
        expect(orphans).toStrictEqual([]);
    });

    // A JS plugin's rules never reach `--print-config`, so only `reportUnusedDisableDirectives` refuses this.
    test('refuses a directive naming a @jterrazz/test rule the plugin does not ship', () => {
        // Given - the node profile composed with @jterrazz/test's testing fragment, and a directive naming a rule it never shipped
        using work = sandbox(resolve(FIXTURES, 'node', 'input'), 'node', 'node');
        symlinkSync(
            resolve(import.meta.dirname, '../../../node_modules/@jterrazz/test'),
            resolve(work.path, 'node_modules/@jterrazz/test'),
            'dir',
        );
        const entry = join(BUILT_FROM, 'dist/oxlint.js');
        writeFileSync(
            work.config,
            `import { testing } from '@jterrazz/test/oxlint';\nimport { compose, node } from '${entry}';\n\nexport default compose(node, testing);\n`,
        );
        writeFileSync(
            resolve(work.path, 'unshipped.ts'),
            "export function pause(): string {\n    // oxlint-disable-next-line jterrazz/unshipped-rule -- a rule the plugin never shipped\n    return 'paused';\n}\n",
        );

        // When - oxlint reads that file under the composed rulebook
        const report = oxlint(work.path, ['-c', work.config, '--format=json', 'unshipped.ts']);

        // Then - the directive itself is the one finding, on its own line, at error
        expect(
            diagnosticsOf(report).map(
                ({ labels, message, severity }) => `${labels[0]?.span.line} ${severity} ${message}`,
            ),
        ).toStrictEqual(['2 error Unused oxlint-disable directive (no problems were reported).']);
    });
});
