import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { mutantsInstrumented, mutantsMade } from '../enumerate.js';
import { ignorersSource } from '../ignorers.js';

const IGNORERS = '.artifacts/stryker/ignorers.mjs';

function projectWith(files: Readonly<Record<string, string>>): string {
    const project = mkdtempSync(join(tmpdir(), 'enumerate-'));
    onTestFinished(() => {
        rmSync(project, { force: true, recursive: true });
    });
    for (const [name, text] of Object.entries({ [IGNORERS]: ignorersSource([]), ...files })) {
        mkdirSync(dirname(join(project, name)), { recursive: true });
        writeFileSync(join(project, name), text);
    }

    return project;
}

describe('enumerate', () => {
    test('mutantsMade — every mutant Stryker makes of the files, at its place counted from 1, except what a directive or an ignorer sets aside', async () => {
        // Given - a source that logs, declares one line equivalent, and decides
        const project = projectWith({
            'src/rates.ts': [
                'export function rated(cents: number): boolean {',
                "    console.info('rating');",
                '    // Stryker disable next-line EqualityOperator: no price is ever exactly a hundred',
                '    const dear = cents > 100;',
                '    return dear;',
                '}',
                '',
            ].join('\n'),
        });

        // Then - the block and the comparison's other mutants, each with the end of its node; nothing of the log, nor the declared mutators
        await expect(mutantsMade(project, ['src/rates.ts'], IGNORERS)).resolves.toStrictEqual([
            {
                column: 47,
                endColumn: 2,
                endLine: 6,
                file: 'src/rates.ts',
                line: 1,
                mutator: 'BlockStatement',
                replacement: '{}',
            },
            {
                column: 18,
                endColumn: 29,
                endLine: 4,
                file: 'src/rates.ts',
                line: 4,
                mutator: 'ConditionalExpression',
                replacement: 'true',
            },
            {
                column: 18,
                endColumn: 29,
                endLine: 4,
                file: 'src/rates.ts',
                line: 4,
                mutator: 'ConditionalExpression',
                replacement: 'false',
            },
        ]);
        await expect(mutantsMade(project, [], IGNORERS)).resolves.toStrictEqual([]);
    });

    test('mutantsInstrumented — every mutant Stryker makes of the files, what a directive or an ignorer sets aside included and marked so', async () => {
        // Given - a source that logs, and decides
        const project = projectWith({
            'src/logs.ts':
                "export function logged(): boolean {\n    console.info('logged');\n    return true;\n}\n",
        });

        const made = await mutantsInstrumented(project, ['src/logs.ts'], IGNORERS);

        // Then - the log's mutants are made too, set aside
        expect(made.map(({ ignored, mutator }) => [mutator, ignored])).toStrictEqual([
            ['BlockStatement', false],
            ['CallExpression', true],
            ['StringLiteral', true],
            ['BooleanLiteral', false],
        ]);
    });

    test('mutantsMade — a plugin of the laid module that is no ignorer is passed over, the ignorers beside it still read', async () => {
        // Given - a module listing a value that is no ignorer before the log ignorer, over a source that only logs
        const project = projectWith({
            '.artifacts/stryker/odd.mjs':
                "export const strykerPlugins = [{ value: 1 }, { value: { shouldIgnore: (path) => (path.isExpressionStatement() ? 'logs' : undefined) } }];\n",
            'src/logs.ts': "export function logged(): void {\n    console.info('logged');\n}\n",
        });

        const made = await mutantsMade(project, ['src/logs.ts'], '.artifacts/stryker/odd.mjs');

        // Then - the block alone is made
        expect(made.map(({ mutator }) => mutator)).toStrictEqual(['BlockStatement']);
    });
});
