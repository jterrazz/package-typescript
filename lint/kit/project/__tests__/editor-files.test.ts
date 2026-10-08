import { describe, expect, test } from 'vitest';

import { derivedEditorFiles, tsconfigAdditionsOf } from '../editor-files.js';

const NODE_GLOBS = ['ts', 'tsx', 'js'].map((extension) => `\${configDir}/**/*.${extension}`);

const tsconfigOf = (extended: string, section: unknown): unknown => {
    const { additions } = tsconfigAdditionsOf(section);
    const files = derivedEditorFiles(
        [{ 'tsconfig.json': { json: { extends: extended }, scope: 'unit' } }],
        additions,
    );
    const tsconfig = files['tsconfig.json'];

    return tsconfig !== undefined && 'json' in tsconfig ? tsconfig.json : undefined;
};

describe('editor-files', () => {
    test('derivedEditorFiles — what a project adds to its tsconfig — writes an include beside the globs of the preset it extends, and files as given', () => {
        // Given - a project adding a glob and an ambient file, with its reason
        const section = {
            tsconfig: { files: ['types/ambient.d.ts'], include: ['scripts/**/*.mts'], reason: 'r' },
        };

        // Then - the node preset's globs stay first; a preset with no include of its own, a preset no file names and a foreign config take the addition alone
        expect([
            tsconfigOf('@jterrazz/typescript/tsconfig/node', section),
            tsconfigOf('@jterrazz/typescript/tsconfig/astro', section),
            tsconfigOf('@jterrazz/typescript/tsconfig/nope', section),
            tsconfigOf('x@jterrazz/typescript/tsconfig/node', section),
            tsconfigOf('@jterrazz/typescript/tsconfig/node/strict', section),
        ]).toStrictEqual([
            {
                extends: '@jterrazz/typescript/tsconfig/node',
                files: ['types/ambient.d.ts'],
                include: [...NODE_GLOBS, 'scripts/**/*.mts'],
            },
            ...[
                '@jterrazz/typescript/tsconfig/astro',
                '@jterrazz/typescript/tsconfig/nope',
                'x@jterrazz/typescript/tsconfig/node',
                '@jterrazz/typescript/tsconfig/node/strict',
            ].map((extended) => ({
                extends: extended,
                files: ['types/ambient.d.ts'],
                include: ['scripts/**/*.mts'],
            })),
        ]);
    });

    test('derivedEditorFiles — a tsconfig section with no include — leaves the preset its globs, and one with no reason derives no tsconfig', () => {
        // Given - options alone, and the same section with no reason
        // Then - the preset's include stays unwritten, and the unreasoned section writes nothing
        expect([
            tsconfigOf('@jterrazz/typescript/tsconfig/node', {
                tsconfig: { compilerOptions: { types: ['bun'] }, reason: 'r' },
            }),
            tsconfigOf('@jterrazz/typescript/tsconfig/node', { tsconfig: { include: ['x'] } }),
        ]).toStrictEqual([
            { compilerOptions: { types: ['bun'] }, extends: '@jterrazz/typescript/tsconfig/node' },
            undefined,
        ]);
    });

    test('tsconfigAdditionsOf — what a section adds — reads each value in its shape, and a blank reason is no reason', () => {
        // Given - options written as a list, a blank reason, and no section at all
        // Then - the list is no options, the blank reason a problem, the absent section nothing to add
        expect([
            tsconfigAdditionsOf({
                tsconfig: { compilerOptions: ['strict'], files: 'a.d.ts', reason: 'r' },
            }),
            tsconfigAdditionsOf({ tsconfig: { include: ['x'], reason: '   ' } }),
            tsconfigAdditionsOf(['tsconfig']),
        ]).toStrictEqual([
            { additions: {}, problem: null },
            { additions: null, problem: 'sets `typescript.tsconfig` with no `reason`' },
            { additions: {}, problem: null },
        ]);
    });

    test('derivedEditorFiles — the editor files a unit derives — keeps every other file, drops only the tsconfig a section with no reason spoils, and touches no tsconfig written as text', () => {
        // Given - an oxlint config beside a tsconfig, and a unit whose tsconfig is text
        const oxlint = { scope: 'repository', text: 'export default {};\n' } as const;
        const json = { extends: '@jterrazz/typescript/tsconfig/node' };

        // Then - the oxlint config stays in each case
        expect([
            derivedEditorFiles(
                [{ 'oxlint.config.ts': oxlint, 'tsconfig.json': { json, scope: 'unit' } }],
                null,
            ),
            derivedEditorFiles([{ 'oxlint.config.ts': oxlint }], { include: ['x'] }),
            derivedEditorFiles([{ 'tsconfig.json': { scope: 'unit', text: '{}' } }], {
                include: ['x'],
            }),
        ]).toStrictEqual([
            { 'oxlint.config.ts': oxlint },
            { 'oxlint.config.ts': oxlint },
            { 'tsconfig.json': { scope: 'unit', text: '{}' } },
        ]);
    });
});
