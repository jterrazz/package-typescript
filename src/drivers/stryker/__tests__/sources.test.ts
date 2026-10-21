import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { objectOf } from '../../../../lint/kit/project/json.js';
import { OBSERVED_TESTS_VARIABLE } from '../mutant-setup.js';
import { KILLERS_VARIABLE, RECENT_KILLERS_VARIABLE } from '../previous-killers.js';
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

type Sort = (specs: Spec[]) => Promise<string[]>;

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

let loadedModules = 0;

// invariant: each sequencer is loaded afresh, since it reads the record and the killers once per process; the durations and the context it is handed are read as they stand at each sort.
async function sequencerOver({ durations, provided, root }: Sorting): Promise<Sort> {
    loadedModules += 1;
    const module = `// ${String(loadedModules)}
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
        return async () => [];
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

    return async (specs) => {
        const ordered = await sorted(specs);

        return ordered.map(({ moduleId }) => relative(root, moduleId));
    };
}

async function sortedBy(sorting: Sorting, specs: Spec[]): Promise<string[]> {
    const sort = await sequencerOver(sorting);

    return await sort(specs);
}

const killLine = (killer: string, source = 'src/labels.ts'): string =>
    `${JSON.stringify({ killer, source })}\n`;

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

    test('sequencer — a mutant’s sort reads each file’s duration once, so a file a stopped run skipped never moves ahead; the dry run reads them as they stand', async () => {
        // Given - one sequencer over the dry run's durations, and the files of mutant 7
        const root = observedRun();
        const durations: Record<string, number> = { ...DURATIONS };
        const provided: Record<string, unknown> = { activeMutant: 7, mode: 'mutant' };
        const sort = await sequencerOver({ durations, provided, root });
        const specs = SPECS.map((path) =>
            specOf(root, path.startsWith('src') ? 'unit' : 'cli', path),
        );

        // When - mutant 7's files are sorted, its run stops before the two slow specs, which the cache then holds as taking next to no time, and the next sorts run
        const before = await sort(specs);
        durations['cli:specs/blind.spec.ts'] = 0;
        durations['cli:specs/runs.spec.ts'] = 1;
        const after = await sort(specs);
        provided.mode = 'dry-run';
        const dryRun = await sort(specs);

        // Then - the mutant's order holds, and the dry run reads the durations the cache holds now
        expect({ after, dryRun: dryRun.slice(0, 2) }).toStrictEqual({
            after: before,
            dryRun: ['specs/blind.spec.ts', 'specs/runs.spec.ts'],
        });
    });

    test('sequencer — the files that killed the latest mutants of the source run next, the latest first, and a file that killed one since moves ahead', async () => {
        // Given - the dry run, and a stage whose kills of the label's mutants so far were by the blind spec, then the never-timed one, and one kill of another source
        const root = observedRun();
        const recent = join(root, '.artifacts/recent.jsonl');
        writeFileSync(
            recent,
            `${killLine('specs/blind.spec.ts')}${killLine('specs/never-timed.spec.ts')}${killLine('specs/loads.spec.ts', 'src/missing.ts')}`,
        );
        vi.stubEnv(RECENT_KILLERS_VARIABLE, recent);
        const sort = await sequencerOver({
            durations: DURATIONS,
            provided: { activeMutant: 7, mode: 'mutant' },
            root,
        });
        const specs = SPECS.map((path) =>
            specOf(root, path.startsWith('src') ? 'unit' : 'cli', path),
        );

        // When - mutant 7's files are sorted, then again once the slowest spec has killed one more, while a kill is half written
        const before = await sort(specs);
        writeFileSync(recent, `${killLine('specs/runs.spec.ts')}{"killer":`, { flag: 'a' });
        const after = await sort(specs);

        // Then - the latest killers lead, the latest first; the rest keep the order of what ran the source
        expect({ after, before }).toStrictEqual({
            after: [
                'specs/runs.spec.ts',
                'specs/never-timed.spec.ts',
                'specs/blind.spec.ts',
                'src/__tests__/labels.test.ts',
                'specs/loads.spec.ts',
            ],
            before: [
                'specs/never-timed.spec.ts',
                'specs/blind.spec.ts',
                'src/__tests__/labels.test.ts',
                'specs/runs.spec.ts',
                'specs/loads.spec.ts',
            ],
        });
    });

    test('sequencer — a mutant’s last killer runs first, ahead of the files that ran its source', async () => {
        // Given - the same dry run, and a last report whose only-loading spec killed mutant 7
        const root = observedRun();
        const killers = join(root, '.artifacts/killers.json');
        writeFileSync(killers, JSON.stringify({ 7: 'specs/loads.spec.ts' }));
        vi.stubEnv(KILLERS_VARIABLE, killers);
        const specs = SPECS.map((path) =>
            specOf(root, path.startsWith('src') ? 'unit' : 'cli', path),
        );

        // When - the files of mutant 7 are sorted, then those of mutant 8, which no test killed
        const killed = await sortedBy(
            { durations: DURATIONS, provided: { activeMutant: 7, mode: 'mutant' }, root },
            specs,
        );
        const unkilled = await sortedBy(
            { durations: DURATIONS, provided: { activeMutant: 8, mode: 'mutant' }, root },
            specs,
        );

        // Then - the killer leads mutant 7's files, and mutant 8's keep the order of what ran its source
        expect({ killed: killed[0], unkilled }).toStrictEqual({
            killed: 'specs/loads.spec.ts',
            unkilled: [
                'src/__tests__/labels.test.ts',
                'specs/blind.spec.ts',
                'specs/runs.spec.ts',
                'specs/never-timed.spec.ts',
                'specs/loads.spec.ts',
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

    test('vitestConfigSource — the suite’s config follows the processes its tests spawn, runs its dry run on the stage’s workers and decides each run’s isolation, the module tests’ config does none of it', () => {
        // Given - the config of each stage over one mutated source
        const scope = { exclude: [], mutated: ['src/a.ts'] };
        const suite = vitestConfigSource(scope, { dryRunWorkers: 2, suite: true });
        const modules = vitestConfigSource(scope, { suite: false });

        // Then - the suite's projects add the three plugins beside the test names and force no isolation, the module tests' the test names alone, every file isolated
        expect([pluginsOf(suite), pluginsOf(modules)]).toStrictEqual([
            'plugins: [strykerTestNames, ownProcesses, dryRunWorkers, ownWorker]',
            'plugins: [strykerTestNames]',
        ]);
        expect([suite.includes('isolate: true'), modules.includes('isolate: true')]).toStrictEqual([
            false,
            true,
        ]);
    });
});
