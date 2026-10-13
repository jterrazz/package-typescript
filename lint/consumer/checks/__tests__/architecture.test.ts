import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { UNCRUISED_PATHS } from '../../../kit/project/ground.js';
import {
    crossed,
    cruised,
    dependency,
    finding,
    LAYER,
    READ,
    violation,
} from './architecture.fixtures.js';

describe('architecture', () => {
    test('hands dependency-cruiser the layers as forbidden rules, over the folders of sources, and judges nothing of a map with no layer and no config of its own', async () => {
        // Given - one layer, sources in several folders, and the files a cruise leaves out
        const run = await cruised({
            files: [
                'src/a.ts',
                'src/deep/b.tsx',
                'esm/c.mts',
                'cjs/d.cjs',
                'lib/e.jsx',
                'snap/f.ts.snap',
                'docs/g.md',
                'top.ts',
                '.hidden/h.ts',
            ],
            report: { modules: [], summary: { violations: [] } },
        });

        // Then - the folders of sources, sorted, after the config and the report; the rule as the layer names it, with the shape of the cruise
        expect(run.args.slice(0, 5)).toStrictEqual([
            '--config',
            run.configPath,
            '--output-type',
            'json',
            '--output-to',
        ]);
        expect(run.args.slice(6)).toStrictEqual(['cjs', 'esm', 'lib', 'src']);
        expect(run.config).toStrictEqual({
            forbidden: [
                {
                    from: { path: 'domain' },
                    name: 'domain-stays-pure',
                    severity: 'error',
                    to: { path: 'infrastructure' },
                },
            ],
            options: {
                doNotFollow: { path: 'node_modules' },
                enhancedResolveOptions: {
                    conditionNames: ['import', 'require', 'node', 'default', 'types'],
                    exportsFields: ['exports'],
                },
                exclude: { path: UNCRUISED_PATHS },
                tsPreCompilationDeps: true,
            },
        });
        expect(run.result).toStrictEqual({ findings: [] });
        expect(run.asked).toStrictEqual([['--depcruise', 'depcruise']]);
    });

    test('names the scratch files it writes, and takes the folder back after the cruise', async () => {
        // Given - a cruise
        const run = await cruised({ report: { modules: [], summary: { violations: [] } } });

        // Then - the config and the report sit in a folder of its own, which is gone
        expect(run.configPath).toMatch(
            /\/typescript-architecture-[^/]+\/dependency-cruiser\.json$/u,
        );
        expect(run.args[5]).toBe(join(dirname(run.configPath), 'cruise.json'));
        expect(existsSync(dirname(run.configPath))).toBe(false);
    });

    test('extends the config of the project and gives the compiler its tsconfig, where it holds them', async () => {
        // Given - a project with a tsconfig and a config of its own, and no layer
        const run = await cruised({
            held: { '.dependency-cruiser.mjs': 'export default {};', 'tsconfig.json': '{}' },
            layers: [],
            report: { modules: [], summary: { violations: [] } },
        });

        // Then - both are named by their path, and no rule is forbidden
        expect(run.config).toMatchObject({
            extends: join(run.root, '.dependency-cruiser.mjs'),
            forbidden: [],
            options: { tsConfig: { fileName: join(run.root, 'tsconfig.json') } },
        });
    });

    test('runs nothing for a project that declares no layer and holds no config of its own', async () => {
        // Given - no layer and no config
        const run = await cruised({ layers: [] });

        // Then - nothing was run, and nothing is said
        expect([run.args, run.result]).toStrictEqual([[], {}]);
    });

    test('names the position of the import in its file, whichever quote writes it, and the first of two', async () => {
        // Given - modules importing across the layer with each quote, the specifier first met in a comment, and a double-quoted import before a single-quoted one
        const texts = {
            'src/domain/back.ts': [
                '// ../infrastructure/store',
                'import b from "../infrastructure/store";',
                "import c from '../infrastructure/store';",
            ].join('\n'),
            'src/domain/tick.ts': [
                '// ../infrastructure/store',
                'const t = await import(`../infrastructure/store`);',
            ].join('\n'),
            'src/domain/user.ts': ['', "  import a from '../infrastructure/store';"].join('\n'),
        };
        const run = await cruised({
            held: texts,
            report: {
                modules: Object.keys(texts).map((path) => dependency(path)),
                summary: { violations: Object.keys(texts).map((path) => violation(path)) },
            },
        });

        // Then - each finding is at the quote of the specifier, in line and column
        expect(
            (run.result.findings ?? []).map(({ column, line, path }) => [path, line, column]),
        ).toStrictEqual([
            ['src/domain/back.ts', 2, 15],
            ['src/domain/tick.ts', 2, 24],
            ['src/domain/user.ts', 2, 17],
        ]);
    });

    test('puts a violation at the top of its file when the file cannot be read, does not name the import, or the cruise names none', async () => {
        // Given - a violation whose module is not on the disk, one whose file never names its specifier, and one with no specifier in a file that quotes undefined
        const run = await cruised({
            held: {
                'src/domain/other.ts': 'export {};\n',
                'src/domain/unlisted.ts': "const empty = '';\nconst none = 'undefined';\n",
            },
            report: {
                modules: [dependency('src/domain/other.ts')],
                summary: {
                    violations: [
                        violation('src/domain/gone.ts'),
                        violation('src/domain/other.ts'),
                        violation('src/domain/unlisted.ts'),
                    ],
                },
            },
        });

        // Then - line 1, column 1 for each
        expect(
            (run.result.findings ?? []).map(({ column, line, path }) => [path, line, column]),
        ).toStrictEqual([
            ['src/domain/gone.ts', 1, 1],
            ['src/domain/other.ts', 1, 1],
            ['src/domain/unlisted.ts', 1, 1],
        ]);
    });

    test('teaches a violation by its layer, and one of a rule the layers do not hold by the comment of the config, or by the cruise itself', async () => {
        // Given - three violations: of a layer, of a rule the config comments, and of one it leaves without a comment
        const run = await cruised({
            held: { '.dependency-cruiser.cjs': 'module.exports = {};' },
            report: {
                modules: [],
                summary: {
                    ruleSetUsed: {
                        forbidden: [
                            { comment: 'the config says so', name: 'commented' },
                            { comment: '', name: 'silent' },
                            { name: 'unwritten' },
                        ],
                    },
                    violations: [
                        crossed('domain-stays-pure'),
                        crossed('commented'),
                        crossed('silent'),
                        crossed('unwritten'),
                        crossed('unknown'),
                    ],
                },
            },
        });

        // Then - the lesson each rule teaches, whole
        const forbids = "the project's dependency-cruiser config forbids it";
        const own = {
            fix: 'reach it through a layer the map allows, or change the map where the boundary moved',
            read: READ,
        };
        expect(run.result.findings).toStrictEqual([
            finding('domain-stays-pure', LAYER.why, LAYER),
            finding('commented', 'the config says so', own),
            finding('silent', forbids, own),
            finding('unwritten', forbids, own),
            finding('unknown', forbids, own),
        ]);
    });

    test('says what dependency-cruiser printed when it could not be run, and what it said when it stopped with no report', async () => {
        // Given - a binary that is not there, and one that exits 2 printing a reason and writing no report
        const missing = await cruised({ stand: 'missing' });
        const stopped = await cruised({ said: 'bad rule\n', status: 2 });
        const silent = await cruised({ status: 0 });

        // Then - the first names the tool and the fix, the second the cause; a clean exit with no report judges nothing and fails nothing
        expect(missing.result).toStrictEqual({
            failed: true,
            findings: [],
            lines: [
                expect.stringMatching(
                    /^found: dependency-cruiser could not be run — spawnSync \S+\/nowhere ENOENT · why: the pass hands the tree to dependency-cruiser, and a tool that never ran judged nothing · fix: run 'npm install' so the dependency-cruiser @jterrazz\/typescript pins is installed beside it, then run again · read: docs\/reference\/quality-checks\.md#the-passes$/u,
                ),
            ],
        });
        expect(stopped.result).toStrictEqual({
            failed: true,
            findings: [],
            lines: [
                `found: dependency-cruiser stopped with no report — bad rule · why: the layer map is judged on the graph dependency-cruiser writes, and with no graph no import is judged · fix: correct what dependency-cruiser printed — a layer whose \`from\` or \`to\` it cannot read, a tsconfig it cannot load — then run again · read: ${READ}`,
            ],
        });
        expect(silent.result).toStrictEqual({ findings: [] });
    });

    test('refuses a map with nothing to cruise, a layer that is no rule, and settings that cannot be read', async () => {
        // Given - layers and no folder of sources, entries missing a part or of the wrong kind, and a settings problem
        const nothing = await cruised({ files: ['top.ts', 'README.md'] });
        const malformed = [
            null,
            [],
            'layer',
            { ...LAYER, name: 1 },
            { ...LAYER, fix: undefined },
            { ...LAYER, why: null },
            { ...LAYER, read: 'develop.md' },
            { ...LAYER, from: null },
            { ...LAYER, from: [] },
            { ...LAYER, to: 'infrastructure' },
            { ...LAYER, to: undefined },
        ];
        const refused = await Promise.all(
            malformed.map(async (layer) => await cruised({ layers: [LAYER, layer] })),
        );
        const problem = await cruised({ problem: 'does not load' });

        // Then - each is a failed pass with one line, and the good layer alone passes
        expect(nothing.result).toStrictEqual({
            failed: true,
            findings: [],
            lines: [
                `found: a layer map is declared, but no folder of the project holds a source file for it to cruise · why: a map with nothing to cruise judges no import, and its silence would read as every boundary kept · fix: move the source into a folder, or remove the map that has nothing to judge · read: ${READ}`,
            ],
        });
        expect(refused.map(({ result }) => result.failed)).toStrictEqual(malformed.map(() => true));
        expect(refused[0]?.args).toStrictEqual([]);
        expect(problem.result).toStrictEqual({
            failed: true,
            lines: [
                'found: jterrazz.config.ts does not load · why: every law a project is held to is resolved from that file, and a file that cannot be resolved judges nothing · fix: correct jterrazz.config.ts until it loads and each preset and section has its declared shape, then run again · read: docs/reference/configuration.md#the-merge-order',
            ],
        });
    });
});
