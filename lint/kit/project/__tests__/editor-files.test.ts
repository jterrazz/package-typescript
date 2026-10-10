import { describe, expect, test } from 'vitest';

import { derivedEditorFiles, tsconfigAdditionsOf } from '../editor-files.js';

const inConfigDir = (path: string): string => `\${configDir}/${path}`;

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
        // Given - options written as a list, a blank reason, and a section that is a list or null
        // Then - the list is no options, the blank reason a problem, a section that is no record nothing to add
        expect([
            tsconfigAdditionsOf({
                tsconfig: { compilerOptions: ['strict'], files: 'a.d.ts', reason: 'r' },
            }),
            tsconfigAdditionsOf({ tsconfig: { include: ['x'], reason: '   ' } }),
            tsconfigAdditionsOf(['tsconfig']),
            tsconfigAdditionsOf(null),
        ]).toStrictEqual([
            { additions: {}, problem: null },
            { additions: null, problem: 'sets `typescript.tsconfig` with no `reason`' },
            { additions: {}, problem: null },
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

    test('tsconfigAdditionsOf — the roots declared verbatim — are excluded from the compiler beside the preset’s own exclusions, with or without a tsconfig section', () => {
        // Given - roots of every shape: verbatim, declared but not verbatim, bare reasons, and a verbatim flag that is no boolean true
        const roots = {
            bare: 'a bare reason',
            kept: { reason: 'quoted text', verbatim: true },
            loose: { reason: 'laid out as any other', verbatim: false },
            quoted: { reason: 'upstream', verbatim: true },
            text: { reason: 'flag as text', verbatim: 'true' },
        };
        const preset = '@jterrazz/typescript/tsconfig/node';
        const withSection = tsconfigOf(preset, {
            roots,
            tsconfig: { include: ['scripts/**/*.mts'], reason: 'r' },
        });
        const alone = tsconfigOf(preset, { roots });

        // Then - the preset's exclusions first, then the verbatim roots in the order declared, in both; the section's include beside them
        const excluded = [
            inConfigDir('node_modules'),
            inConfigDir('dist'),
            inConfigDir('.artifacts'),
            inConfigDir('**/__expected__'),
            inConfigDir('**/__fixtures__'),
            inConfigDir('**/__requests__'),
            inConfigDir('**/__seeds__'),
            inConfigDir('kept'),
            inConfigDir('quoted'),
        ];
        expect([withSection, alone]).toStrictEqual([
            {
                exclude: excluded,
                extends: preset,
                include: [...NODE_GLOBS, 'scripts/**/*.mts'],
            },
            { exclude: excluded, extends: preset },
        ]);
    });

    test('tsconfigAdditionsOf — a section with no verbatim root, or whose roots are no record — adds no exclusion', () => {
        // Given - roots of no verbatim declaration, a list of roots, and a section with none
        const additions = [
            { roots: { loose: { reason: 'r' } } },
            { roots: ['kept'] },
            { roots: 'kept' },
            {},
        ].map((section) => tsconfigAdditionsOf(section));

        // Then - nothing to exclude
        expect(additions).toStrictEqual(
            Array.from({ length: 4 }, () => ({ additions: {}, problem: null })),
        );
    });
});
