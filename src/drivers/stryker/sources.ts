import { join } from 'node:path';

import { DIST, MUTATION_OUTPUT } from '../../../lint/kit/project/build-plan.js';
import { IN_PROCESS_VARIABLE, OBSERVED_TESTS_VARIABLE } from './mutant-setup.js';
import { KILLERS_VARIABLE, RECENT_KILLERS_VARIABLE } from './previous-killers.js';

// outside: Stryker 10 names a test by its suites and title joined with a space, where Vitest 5 joins them with ` > `: without this plugin every mutant runs no test and survives.
const TEST_NAME_PLUGIN_SOURCE = `const strykerTestNames = {
    configureVitest({ project }) {
        let pattern;
        Object.defineProperty(project.config, 'testNamePattern', {
            configurable: true,
            enumerable: true,
            get: () => pattern,
            set: (stated) => {
                pattern = stated === undefined ? undefined : new RegExp((stated instanceof RegExp ? stated.source : stated).replaceAll('\\\\-', '-').replaceAll(' ', '(?: > | )'), 'u');
            },
        });
    },
    name: 'stryker-test-names',
};`;

// outside: Vitest runs the slowest file first, and Stryker stops a mutant's run at the first test that fails; the file whose test killed the mutant in the stage's last report runs first, then the files that killed the latest of this stage's mutants of its source, the latest first, then the files with a test whose processes ran a function of the mutant's source run first (a test that spawned nothing, or one the dry run could not follow, among them), since a mutant a spawned process only loaded is credited to every file that spawned one, and within each group the file the last run took least time over runs first, so a mutant a quick test detects never waits on a slow one.
// hazard: Vitest records a file a stopped run skipped as taking no time, so a duration read again after a mutant's run would send the files that run never reached to the front of the next; a mutant's sort reads each file's duration once, at its first, from the dry run's measure.
export const relevantFirstSource = (
    mutated: readonly string[],
): string => `const mutantSources = new Map();
const mutated = ${JSON.stringify(mutated)};
const sourceOfMutant = (root, id) => {
    if (mutantSources.size === 0) {
        for (const source of mutated) {
            const text = existsSync(join(root, source)) ? readFileSync(join(root, source), 'utf8') : '';
            for (const [, one] of text.matchAll(/stryMutAct_9fa48\\("(\\d+)"\\)/gu)) {
                mutantSources.set(one, source);
            }
        }
    }
    return mutantSources.get(id);
};
let ranByFile;
const ranByFileOf = () => {
    if (ranByFile === undefined) {
        ranByFile = new Map();
        const folder = process.env.${OBSERVED_TESTS_VARIABLE};
        for (const name of folder !== undefined && existsSync(folder) ? readdirSync(folder) : []) {
            for (const { loaded, ran, test } of JSON.parse(readFileSync(join(folder, name), 'utf8'))) {
                const file = test.split('#')[0];
                const held = ranByFile.get(file) ?? [];
                held.push(ran === undefined || (ran.length === 0 && loaded.length === 0) ? undefined : new Set(ran));
                ranByFile.set(file, held);
            }
        }
    }
    return ranByFile;
};

let killers;
const killerOf = (id) => {
    if (killers === undefined) {
        const file = process.env.${KILLERS_VARIABLE};
        killers = file !== undefined && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    }
    return killers[id];
};

const RECENT_KILLERS = 3;
let recentKillers = { bySource: new Map(), size: -1 };
const recentOf = (source) => {
    const file = process.env.${RECENT_KILLERS_VARIABLE};
    if (source === undefined || file === undefined || !existsSync(file)) {
        return [];
    }
    const { size } = statSync(file);
    if (size !== recentKillers.size) {
        const bySource = new Map();
        for (const line of readFileSync(file, 'utf8').split('\\n').slice(0, -1)) {
            const { killer, source: of } = JSON.parse(line);
            bySource.set(of, [killer, ...(bySource.get(of) ?? []).filter((one) => one !== killer)].slice(0, RECENT_KILLERS));
        }
        recentKillers = { bySource, size };
    }
    return recentKillers.bySource.get(source) ?? [];
};

const frozenDurations = new Map();

class RelevantFirst extends BaseSequencer {
    async sort(files) {
        const { root } = this.ctx.config;
        const { activeMutant, mode } = this.ctx.getRootProject().getProvidedContext();
        const timed = (key) => this.ctx.cache.getFileTestResults(key)?.duration ?? Number.POSITIVE_INFINITY;
        const took = (file) => {
            const key = \`\${file.project.name}:\${relative(root, file.moduleId)}\`;
            if (mode !== 'mutant') {
                return timed(key);
            }
            if (!frozenDurations.has(key)) {
                frozenDurations.set(key, timed(key));
            }
            return frozenDurations.get(key);
        };
        const source = mode === 'mutant' ? sourceOfMutant(root, String(activeMutant)) : undefined;
        const tests = source === undefined ? undefined : ranByFileOf();
        const relevant = (file) => tests === undefined || (tests.get(relative(root, file.moduleId)) ?? [undefined]).some((ran) => ran === undefined || ran.has(source));
        const killer = mode === 'mutant' ? killerOf(String(activeMutant)) : undefined;
        const killed = (file) => relative(root, file.moduleId) === killer;
        const recent = recentOf(source);
        const recency = (file) => {
            const at = recent.indexOf(relative(root, file.moduleId));
            return at === -1 ? recent.length : at;
        };
        return [...files].sort((a, b) => Number(killed(b)) - Number(killed(a)) || recency(a) - recency(b) || Number(relevant(b)) - Number(relevant(a)) || took(a) - took(b) || 0);
    }
}`;

// hazard: Stryker reads the tests of each file, and a file a mutant stops from loading holds none, so the mutant would read as survived; the file's failure is handed over as a failed test.
const LOAD_FAILURES_REPORTER_SOURCE = `const loadFailures = {
    onTestRunEnd(testModules) {
        for (const { task: file } of testModules) {
            if (file.result?.state === 'fail' && file.tasks.length === 0) {
                file.tasks.push({
                    file,
                    id: \`\${file.id}_loads\`,
                    meta: {},
                    mode: 'run',
                    name: 'the test file loads',
                    result: { errors: file.result.errors ?? [], state: 'fail' },
                    suite: file,
                    type: 'test',
                });
            }
        }
    },
};
`;

// hazard: Stryker runs Vitest in worker threads, where a native addon a spec loads (a database driver) can crash the process; the suite runs each test file in a process of its own, as Vitest does by default.
const OWN_PROCESSES_PLUGIN_SOURCE = `const ownProcesses = {
    configureVitest({ project }) {
        project.config.pool = 'forks';
    },
    name: 'stryker-own-processes',
};
`;

// outside: Stryker's Vitest runner runs every test file on one worker, which a mutant's run needs, since the mutant is live in the process that runs its tests; the dry run activates no mutant and Stryker reads its coverage file by file, so it runs on the stage's test runners, read again on every run.
const dryRunWorkersPluginSource = (workers: number): string => `const dryRunWorkers = {
    configureVitest({ project, vitest }) {
        Object.defineProperty(project.config, 'maxWorkers', {
            configurable: true,
            enumerable: true,
            get: () => (vitest.getRootProject().getProvidedContext().mode === 'dry-run' ? ${String(workers)} : 1),
            set: () => {},
        });
    },
    name: 'stryker-dry-run-workers',
};
`;

// invariant: a mutant the dry run ran in a test file's own process is live in the worker as its modules load, so its run gives each file a process of its own; a mutant only the processes a test spawns ran is live in each child from its start, so its run keeps the worker as the project's own test run does. The dry run gives each file its own, since a module loaded once per worker would credit its loading to the first file alone.
const OWN_WORKER_PLUGIN_SOURCE = `let inProcess;
const inProcessOf = () => {
    if (inProcess === undefined) {
        const folder = process.env.${IN_PROCESS_VARIABLE};
        inProcess = new Set((folder !== undefined && existsSync(folder) ? readdirSync(folder) : []).flatMap((name) => readFileSync(join(folder, name), 'utf8').split('\\n')));
    }
    return inProcess;
};
const ownWorker = {
    configureVitest({ project, vitest }) {
        const own = project.config.isolate;
        Object.defineProperty(project.config, 'isolate', {
            configurable: true,
            enumerable: true,
            get: () => {
                const { activeMutant, mode } = vitest.getRootProject().getProvidedContext();
                return mode !== 'mutant' || inProcessOf().has(String(activeMutant)) || own;
            },
            set: () => {},
        });
    },
    name: 'stryker-own-worker',
};
`;

/** The folders of the repository a member's specs reach by climbing out of it: where the sandbox's copy stands, and the names to lay beside it. */
export type Beside = { levels: number; names: readonly string[]; root: string };

// invariant: the sandbox lies four folders below its member (`.artifacts/stryker/tmp/sandbox-*`), so a spec that climbs `levels` folders out of a member lands `levels` folders above the copy; the repository's top-level entries are linked there, for the climbs that land inside `.artifacts/`.
const besideScript = ({ levels, names, root }: Beside): string =>
    `import { existsSync as present, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const beside = resolve(process.cwd(), ${JSON.stringify('../'.repeat(levels))});
for (const name of ${JSON.stringify(names)}) {
    if (!present(join(beside, name))) {
        symlinkSync(join(${JSON.stringify(root)}, name), join(beside, name));
    }
}
`;

export const SANDBOX_DEPTH = 4;

// outside: the checks a test runs read the git tree, and the sandbox lies in the ignored .artifacts/, where git sees none.
// invariant: the build the suite runs against holds the declarations of the project's own build: a mutant changes what the code does, never the types it declares, and a declaration emitted from instrumented code infers wider types than the code states.
export const sandboxScriptSource = (build: boolean, project: string, beside?: Beside): string =>
    `import { execFileSync } from 'node:child_process';
${build ? "import { cpSync, existsSync, statSync } from 'node:fs';\n" : ''}
execFileSync('git', ['init', '--quiet']);
execFileSync('git', ['add', '--all']);
${
    build
        ? `execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
const declarations = ${JSON.stringify(join(project, DIST))};
if (existsSync(declarations)) {
    cpSync(declarations, ${JSON.stringify(DIST)}, {
        filter: (path) => statSync(path).isDirectory() || /\\.d\\.[cm]?ts(?:\\.map)?$/u.test(path),
        recursive: true,
    });
}
`
        : ''
}${beside !== undefined && beside.levels > 0 && beside.levels < SANDBOX_DEPTH ? `\n${besideScript(beside)}` : ''}`;

/** What a stage's Vitest config runs: the suite, its dry run on the stage's test runners, or the module tests alone. */
export type VitestStage = { dryRunWorkers: number; suite: true } | { suite: false };

export function vitestConfigSource(
    { exclude, mutated }: { exclude: readonly string[]; mutated: readonly string[] },
    stage: VitestStage,
): string {
    const { suite } = stage;
    const kept = suite
        ? 'projects.filter((project) => project.test?.browser?.enabled !== true)'
        : "projects.filter((project) => project.test?.name === 'unit')";

    return `import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { mergeConfig } from 'vitest/config';
import { BaseSequencer } from 'vitest/node';

import declared from '../../vitest.config.ts';

const project = typeof declared === 'function' ? await declared({ command: 'serve', mode: 'test' }) : await declared;

${TEST_NAME_PLUGIN_SOURCE}

${relevantFirstSource(mutated)}

${LOAD_FAILURES_REPORTER_SOURCE}
${stage.suite ? `${OWN_PROCESSES_PLUGIN_SOURCE}\n${dryRunWorkersPluginSource(stage.dryRunWorkers)}\n${OWN_WORKER_PLUGIN_SOURCE}` : ''}
const projects = project.test?.projects ?? [];

const setup = resolve(${JSON.stringify(`${MUTATION_OUTPUT}/mutant-setup.mjs`)});

const listed = (files) => (files === undefined ? [] : [files].flat());

export default {
    ...project,
    test: {
        ...project.test,
        coverage: { enabled: false },
        reporters: [loadFailures],
        sequence: { ...project.test?.sequence, sequencer: RelevantFirst },
        projects: ${kept}.map((one) =>
            mergeConfig(
                { ...one, test: { ...one.test, setupFiles: [setup, ...listed(one.test?.setupFiles)] } },
                { plugins: [strykerTestNames${suite ? ', ownProcesses, dryRunWorkers, ownWorker' : ''}], test: { exclude: ${JSON.stringify(exclude)}${suite ? '' : ', isolate: true'} } },
            ),
        ),
    },
};
`;
}
