import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { objectOf } from '../../../../lint/kit/project/json.js';
import { OBSERVED_TESTS_VARIABLE } from '../mutant-setup.js';
import { relevantFirstSource, sandboxScriptSource, vitestConfigSource } from '../sources.js';

const pluginsOf = (source: string): string | undefined => /plugins: \[[^\]]*\]/u.exec(source)?.[0];

const WIDE = 'export declare const kind: string;\n';

const EXACT = "export declare const kind: 'api';\n";

function laid(root: string, files: Readonly<Record<string, string>>): void {
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(join(root, path, '..'), { recursive: true });
        writeFileSync(join(root, path), text);
    }
}

type Spec = { moduleId: string; project: { name: string } };

type Sequencer = { sort: (files: Spec[]) => Promise<Spec[]> };

type SequencerClass = new (ctx: unknown) => Sequencer;

const isClass = (value: unknown): value is SequencerClass => typeof value === 'function';

const specOf = (root: string, project: string, path: string): Spec => ({
    moduleId: join(root, path),
    project: { name: project },
});

type Sorting = {
    durations: Readonly<Record<string, number>>;
    provided: Readonly<Record<string, unknown>>;
    root: string;
};

async function sortedBy({ durations, provided, root }: Sorting, specs: Spec[]): Promise<string[]> {
    const module = `import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
class BaseSequencer {
    constructor(ctx) {
        this.ctx = ctx;
    }
}
${relevantFirstSource(['src/labels.ts', 'src/missing.ts'])}
export { RelevantFirst };
`;
    const imported: unknown = await import(`data:text/javascript,${encodeURIComponent(module)}`);
    const { RelevantFirst } = objectOf(imported);
    if (!isClass(RelevantFirst)) {
        return [];
    }
    const sequencer = new RelevantFirst({
        cache: {
            getFileTestResults: (key: string) =>
                key in durations ? { duration: durations[key] } : undefined,
        },
        config: { root },
        getRootProject: () => ({ getProvidedContext: () => provided }),
    });
    const sorted: Sequencer['sort'] = sequencer.sort.bind(sequencer);
    const order = await sorted(specs);

    return order.map(({ moduleId }) => relative(root, moduleId));
}

const DURATIONS = {
    'cli:specs/blind.spec.ts': 30,
    'cli:specs/loads.spec.ts': 10,
    'cli:specs/runs.spec.ts': 40,
    'unit:src/__tests__/labels.test.ts': 20,
};

function observedRun(): string {
    const root = mkdtempSync(join(tmpdir(), 'mutation-sequencer-'));
    const observed = join(root, '.artifacts/observed');
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    laid(root, {
        '.artifacts/observed/1-1.json': JSON.stringify([
            {
                loaded: ['src/cli.ts', 'src/labels.ts'],
                ran: ['src/cli.ts'],
                test: 'specs/loads.spec.ts#a',
            },
            {
                loaded: ['src/cli.ts', 'src/labels.ts'],
                ran: ['src/cli.ts', 'src/labels.ts'],
                test: 'specs/runs.spec.ts#b',
            },
        ]),
        '.artifacts/observed/2-1.json': JSON.stringify([
            { loaded: [], ran: [], test: 'src/__tests__/labels.test.ts#reads a label' },
            { test: 'specs/blind.spec.ts#c' },
        ]),
        'src/labels.ts':
            'const LABEL = stryMutAct_9fa48("7") ? "" : (stryCov_9fa48("7"), "b");\nexport const labelOf = () => stryMutAct_9fa48("8") ? undefined : LABEL;\n',
    });
    vi.stubEnv(OBSERVED_TESTS_VARIABLE, observed);

    return root;
}

const SPECS = [
    'specs/runs.spec.ts',
    'specs/never-timed.spec.ts',
    'specs/loads.spec.ts',
    'specs/blind.spec.ts',
    'src/__tests__/labels.test.ts',
] as const;

describe('sources', () => {
    test('sequencer — a mutant’s tests run the files that ran its source first, quickest first within each group, a file no run timed last', async () => {
        // Given - a dry run that saw a spec only load the mutant's source, one run a function of it, a module test that spawned nothing, a spec it could not follow, and a file it never timed
        const root = observedRun();
        const specs = SPECS.map((path) =>
            specOf(root, path.startsWith('src') ? 'unit' : 'cli', path),
        );

        // When - the files of mutant 7 are sorted, then those of a mutant no instrumented source holds, then those of the dry run itself
        const order = await sortedBy(
            { durations: DURATIONS, provided: { activeMutant: 7, mode: 'mutant' }, root },
            specs,
        );
        const unknown = await sortedBy(
            { durations: DURATIONS, provided: { activeMutant: 99, mode: 'mutant' }, root },
            specs,
        );
        const dryRun = await sortedBy(
            { durations: DURATIONS, provided: { mode: 'dry-run' }, root },
            specs,
        );

        // Then - what ran the source, spawned nothing or went unfollowed comes before what only loaded it; a mutant of no known source, and the dry run, run quickest first alone
        expect({ dryRun, order, unknown }).toStrictEqual({
            dryRun: [
                'specs/loads.spec.ts',
                'src/__tests__/labels.test.ts',
                'specs/blind.spec.ts',
                'specs/runs.spec.ts',
                'specs/never-timed.spec.ts',
            ],
            order: [
                'src/__tests__/labels.test.ts',
                'specs/blind.spec.ts',
                'specs/runs.spec.ts',
                'specs/never-timed.spec.ts',
                'specs/loads.spec.ts',
            ],
            unknown: [
                'specs/loads.spec.ts',
                'src/__tests__/labels.test.ts',
                'specs/blind.spec.ts',
                'specs/runs.spec.ts',
                'specs/never-timed.spec.ts',
            ],
        });
    });

    test('sandboxScriptSource — the suite runs against the instrumented build carrying the project’s own declarations', () => {
        // Given - a project built from its sources, and a sandbox whose build infers its declarations wider
        const project = mkdtempSync(join(tmpdir(), 'mutation-project-'));
        const sandbox = mkdtempSync(join(tmpdir(), 'mutation-sandbox-'));
        onTestFinished(() => {
            rmSync(project, { force: true, recursive: true });
            rmSync(sandbox, { force: true, recursive: true });
        });
        laid(project, { 'dist/index.d.ts': EXACT, 'dist/index.js': 'original' });
        const build = `mkdir -p dist/nested && printf '${WIDE}' | tee dist/index.d.ts dist/nested/only.d.ts > /dev/null && printf instrumented > dist/index.js`;
        laid(sandbox, { 'package.json': JSON.stringify({ scripts: { build } }) });
        writeFileSync(join(sandbox, 'sandbox.mjs'), sandboxScriptSource(true, project));

        // When - the sandbox script runs
        execFileSync(process.execPath, ['sandbox.mjs'], { cwd: sandbox, stdio: 'ignore' });

        // Then - the project's declaration replaces the instrumented one, the code and a declaration only the sandbox holds stay
        expect(
            ['dist/index.d.ts', 'dist/index.js', 'dist/nested/only.d.ts'].map((path) =>
                readFileSync(join(sandbox, path), 'utf8'),
            ),
        ).toStrictEqual([EXACT, 'instrumented', WIDE]);
    });

    test('sandboxScriptSource — a run that builds nothing only lays the git tree', () => {
        // Given - a project whose suite builds nothing
        const script = sandboxScriptSource(false, '/project');

        // Then - no build, no declaration copied
        expect(script).toBe(
            "import { execFileSync } from 'node:child_process';\n\nexecFileSync('git', ['init', '--quiet']);\nexecFileSync('git', ['add', '--all']);\n",
        );
    });

    test('sandboxScriptSource — a member’s sandbox holds the repository’s top-level entries where its specs climb to', () => {
        // Given - a repository with a testdata/ folder and a member two folders down, and the sandbox of that member four folders below it
        const repository = mkdtempSync(join(tmpdir(), 'mutation-repository-'));
        onTestFinished(() => {
            rmSync(repository, { force: true, recursive: true });
        });
        const sandbox = join(repository, 'packages/server/.artifacts/stryker/tmp/sandbox-1');
        laid(repository, { 'testdata/golden.json': '{}', 'packages/server/package.json': '{}' });
        mkdirSync(sandbox, { recursive: true });
        writeFileSync(
            join(sandbox, 'sandbox.mjs'),
            sandboxScriptSource(false, join(repository, 'packages/server'), {
                levels: 2,
                names: ['testdata'],
                root: repository,
            }),
        );

        // When - the sandbox script runs
        execFileSync(process.execPath, ['sandbox.mjs'], { cwd: sandbox, stdio: 'ignore' });

        // Then - a spec of the copy that climbs two folders out of it reads the repository's file, at the place the real tree would have it
        expect(readFileSync(join(sandbox, '../../testdata/golden.json'), 'utf8')).toBe('{}');
    });

    test('sandboxScriptSource — no entry is laid for a project that is the repository, nor for a climb that leaves the sandbox’s own folders', () => {
        // Given - a root project (no folder to climb), and a member four folders down
        const root = sandboxScriptSource(false, '/project', {
            levels: 0,
            names: ['docs'],
            root: '/r',
        });
        const deep = sandboxScriptSource(false, '/project', {
            levels: 4,
            names: ['docs'],
            root: '/r',
        });

        // Then - the script only lays the git tree in both
        expect([root, deep]).toStrictEqual([
            sandboxScriptSource(false, '/project'),
            sandboxScriptSource(false, '/project'),
        ]);
    });

    test('vitestConfigSource — the suite’s config follows the processes its tests spawn and runs its dry run on the stage’s workers, the module tests’ config does neither', () => {
        // Given - the config of each stage over one mutated source
        const scope = { exclude: [], mutated: ['src/a.ts'] };

        // Then - the suite's projects add the two plugins beside the test names, the module tests' the test names alone
        expect([
            pluginsOf(vitestConfigSource(scope, { dryRunWorkers: 2, suite: true })),
            pluginsOf(vitestConfigSource(scope, { suite: false })),
        ]).toStrictEqual([
            'plugins: [strykerTestNames, ownProcesses, dryRunWorkers]',
            'plugins: [strykerTestNames]',
        ]);
    });
});
