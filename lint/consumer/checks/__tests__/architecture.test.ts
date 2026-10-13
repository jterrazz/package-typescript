import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import type { Context } from '../../../kit/checker/pass.js';
import { UNCRUISED_PATHS } from '../../../kit/project/ground.js';
import type { Resolution } from '../../../kit/project/preset.js';
import { architecture } from '../architecture.js';

const READ = 'docs/reference/quality-checks.md#the-architecture-layer-map-pass';

const LAYER = {
    fix: 'import it through the port',
    from: { path: 'domain' },
    name: 'domain-stays-pure',
    read: 'docs/guides/develop.md#layers',
    to: { path: 'infrastructure' },
    why: 'A domain module never reaches for infrastructure.',
};

function scratch(): string {
    const made = mkdtempSync(join(tmpdir(), 'architecture-'));
    const directory = realpathSync(made);
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });

    return directory;
}

function resolution(layers: unknown[], problem: null | string = null): Resolution {
    return {
        problem,
        resolved: {
            baseline: [],
            declaration: null,
            laws: [],
            layers,
            names: [],
            optOuts: [],
            own: {},
            presets: [],
            sections: {},
        },
    };
}

type Setup = {
    files?: string[];
    held?: Record<string, string>;
    layers?: unknown[];
    problem?: null | string;
    said?: string;
    status?: number;
    report?: unknown;
    stand?: 'missing' | 'present';
};

type Run = {
    args: string[];
    asked: (string | undefined)[][];
    config: unknown;
    configPath: string;
    root: string;
    result: Awaited<ReturnType<typeof architecture.check>>;
};

// outside: dependency-cruiser is stood in for by a script that records what it was handed and writes the report the case gives it, so the pass is proved on every report it can be handed.
async function cruised(setup: Setup): Promise<Run> {
    const root = scratch();
    const bin = scratch();
    for (const [path, text] of Object.entries(setup.held ?? {})) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    if (setup.report !== undefined) {
        writeFileSync(join(bin, 'report.json'), JSON.stringify(setup.report));
    }
    writeFileSync(join(bin, 'said.txt'), setup.said ?? '');
    const stand = join(bin, 'depcruise');
    writeFileSync(
        stand,
        `#!/bin/sh
printf '%s\\n' "$@" > '${bin}/args.txt'
cp "$2" '${bin}/config.json'
[ -f '${bin}/report.json' ] && cp '${bin}/report.json' "$6"
cat '${bin}/said.txt'
exit ${String(setup.status ?? 0)}
`,
    );
    chmodSync(stand, 0o755);
    const asked: (string | undefined)[][] = [];
    const context: Context = {
        config: async () =>
            await Promise.resolve(resolution(setup.layers ?? [LAYER], setup.problem)),
        exists: (path) => existsSync(path),
        files: () => setup.files ?? ['src/a.ts'],
        fix: false,
        has: () => false,
        list: () => null,
        positionals: [],
        read: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null),
        root,
        value: (flag: string, fallback?: string) => {
            asked.push([flag, fallback]);

            return setup.stand === 'missing' ? join(bin, 'nowhere') : stand;
        },
        verbatim: async () => await Promise.resolve([]),
    };
    const result = await architecture.check(context);
    const args = existsSync(join(bin, 'args.txt'))
        ? readFileSync(join(bin, 'args.txt'), 'utf8').trim().split('\n')
        : [];
    const config: unknown = existsSync(join(bin, 'config.json'))
        ? JSON.parse(readFileSync(join(bin, 'config.json'), 'utf8'))
        : null;

    return { args, asked, config, configPath: args[1] ?? '', result, root };
}

const violation = (
    from: string,
    rule = 'domain-stays-pure',
    to = 'src/infrastructure/store.ts',
): unknown => ({
    from,
    rule: { name: rule },
    to,
});

const crossed = (rule: string): unknown => violation(`src/${rule}.ts`, rule, 'src/b.ts');

const dependency = (source: string): unknown => ({
    dependencies: [{ module: '../infrastructure/store', resolved: 'src/infrastructure/store.ts' }],
    source,
});

const finding = (rule: string, why: string, teaching: { fix: string; read: string }): unknown => ({
    column: 1,
    line: 1,
    message: `found: \`src/${rule}.ts\` imports \`src/b.ts\` · why: ${why} · fix: ${teaching.fix} · read: ${teaching.read}`,
    path: `src/${rule}.ts`,
    rule: `architecture/${rule}`,
});

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

    test('puts a violation at the top of its file when the file cannot be read or does not name the import', async () => {
        // Given - a violation whose module is not on the disk, and one whose file never names the specifier
        const run = await cruised({
            held: { 'src/domain/other.ts': "const empty = '';\n" },
            report: {
                modules: [],
                summary: {
                    violations: [violation('src/domain/gone.ts'), violation('src/domain/other.ts')],
                },
            },
        });

        // Then - line 1, column 1 for both
        expect(
            (run.result.findings ?? []).map(({ column, line, path }) => [path, line, column]),
        ).toStrictEqual([
            ['src/domain/gone.ts', 1, 1],
            ['src/domain/other.ts', 1, 1],
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
