export const ARTIFACTS = '.artifacts';

export const OUT = `${ARTIFACTS}/stryker`;

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

// hazard: Stryker runs Vitest in worker threads, where a native addon a spec loads — a database driver — can crash the process; the suite runs each test file in a process of its own, as Vitest does by default.
const OWN_PROCESSES_PLUGIN_SOURCE = `const ownProcesses = {
    configureVitest({ project }) {
        project.config.pool = 'forks';
    },
    name: 'stryker-own-processes',
};
`;

// invariant: every process a test spawns runs the instrumented build with this module imported first: it reports the mutants it ran — the parent credits them to the test that spawned it.
// hazard: no handler catches SIGKILL, and one for SIGTERM would swallow a signal a process sends itself as it ends; the reporter hands back what is new every tenth of a second instead, so a killed process loses only its last tenth, and one still running after its test file's last test hands back nothing more.
export const CHILD_COVERAGE_SOURCE = `const { renameSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const into = process.env.__STRYKER_CHILD_COVERAGE__;
const name = \`\${process.pid}-\${Date.now()}-\${Math.random().toString(36).slice(2)}\`;
const sent = {};
let written = 0;

function report() {
    const coverage = globalThis.__stryker__?.mutantCoverage;
    if (into === undefined || coverage === undefined) {
        return;
    }
    const hits = { ...coverage.static };
    for (const perTest of Object.values(coverage.perTest)) {
        for (const [id, count] of Object.entries(perTest)) {
            hits[id] = (hits[id] ?? 0) + count;
        }
    }
    const fresh = {};
    let any = false;
    for (const [id, count] of Object.entries(hits)) {
        if (count > (sent[id] ?? 0)) {
            fresh[id] = count - (sent[id] ?? 0);
            sent[id] = count;
            any = true;
        }
    }
    if (!any) {
        return;
    }
    written += 1;
    const path = join(into, \`\${name}-\${written}.json\`);
    writeFileSync(\`\${path}.partial\`, JSON.stringify(fresh));
    renameSync(\`\${path}.partial\`, path);
}

process.on('exit', report);
setInterval(report, 100).unref();
`;

export const RAN_BY_TESTS_VARIABLE = '__TYPESCRIPT_MUTATION_RAN_BY_TESTS__';

// invariant: first of every project's setup files — a mutant is live before the test file loads, and a static mutant is credited to every test of each file whose loading ran it; the mutants a test ran in its own process, beyond loading its file, are written where RAN_BY_TESTS_VARIABLE names; what a process it spawned ran stays apart, since a child's loading and its calls cannot be told apart.
export const MUTANT_SETUP_SOURCE = `import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { threadId } from 'node:worker_threads';
import { afterAll, afterEach, beforeEach, inject } from 'vitest';

const ns = globalThis.__stryker__ ?? (globalThis.__stryker__ = {});

if (inject('mode') === 'mutant') {
    ns.activeMutant = String(inject('activeMutant'));
    process.env.__STRYKER_ACTIVE_MUTANT__ = ns.activeMutant;
    delete process.env.__STRYKER_CHILD_COVERAGE__;
} else {
    delete process.env.__STRYKER_ACTIVE_MUTANT__;
    const children = join(process.cwd(), ${JSON.stringify(OUT)}, 'children', \`\${process.pid}-\${threadId}\`);
    mkdirSync(children, { recursive: true });
    process.env.__STRYKER_CHILD_COVERAGE__ = children;
    const reporter = \`--require="\${join(process.cwd(), ${JSON.stringify(OUT)}, 'child-coverage.cjs')}"\`;
    if (!(process.env.NODE_OPTIONS ?? '').includes(reporter)) {
        process.env.NODE_OPTIONS = \`\${process.env.NODE_OPTIONS ?? ''} \${reporter}\`.trim();
    }

    const coverage = () => ns.mutantCoverage ?? (ns.mutantCoverage = { perTest: {}, static: {} });
    const loaded = { ...coverage().static };
    const tests = new Set();
    const ranByTests = new Set();
    let current;

    const add = (into, hits) => {
        for (const [id, count] of Object.entries(hits)) {
            into[id] = (into[id] ?? 0) + count;
        }
    };
    const drained = () => {
        const hits = {};
        for (const name of readdirSync(children)) {
            if (name.endsWith('.json')) {
                add(hits, JSON.parse(readFileSync(join(children, name), 'utf8')));
                rmSync(join(children, name));
            }
        }
        return hits;
    };
    const nameOf = (task) => {
        const parts = [task.name];
        for (let suite = task.suite; suite; suite = suite.suite) {
            parts.unshift(suite.name);
        }
        return \`\${task.file?.filepath ?? 'unknown.js'}#\${parts.join(' ').trim()}\`;
    };
    const fileWide = {};

    beforeEach(({ task }) => {
        add(fileWide, drained());
        current = nameOf(task);
        tests.add(current);
    });

    afterEach(() => {
        const perTest = coverage().perTest;
        for (const id of Object.keys(perTest[current] ?? {})) {
            ranByTests.add(id);
        }
        add(perTest[current] ?? (perTest[current] = {}), drained());
    });

    afterAll(({}, suite) => {
        add(fileWide, drained());
        const { perTest, static: statics } = coverage();
        const ranInto = process.env.${RAN_BY_TESTS_VARIABLE};
        if (ranInto !== undefined) {
            mkdirSync(ranInto, { recursive: true });
            writeFileSync(join(ranInto, \`\${process.pid}-\${threadId}-\${Math.random().toString(36).slice(2)}.txt\`), [...ranByTests].join('\\n'));
        }
        for (const [id, count] of Object.entries(statics)) {
            const before = loaded[id] ?? 0;
            if (count > before) {
                fileWide[id] = (fileWide[id] ?? 0) + count - before;
            }
        }
        for (const test of tests) {
            add(perTest[test] ?? (perTest[test] = {}), fileWide);
        }
        suite.meta.mutantCoverage = coverage();
    });
}
`;

// outside: the checks a test runs read the git tree, and the sandbox lies in the ignored .artifacts/, where git sees none.
export const sandboxScriptSource = (
    build: boolean,
): string => `import { execFileSync } from 'node:child_process';

execFileSync('git', ['init', '--quiet']);
execFileSync('git', ['add', '--all']);
${build ? "execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });\n" : ''}`;

export function vitestConfigSource(exclude: readonly string[], suite: boolean): string {
    const kept = suite
        ? 'projects.filter((project) => project.test?.browser?.enabled !== true)'
        : "projects.filter((project) => project.test?.name === 'unit')";

    return `import { resolve } from 'node:path';

import { mergeConfig } from 'vitest/config';

import declared from '../../vitest.config.ts';

const project = typeof declared === 'function' ? await declared({ command: 'serve', mode: 'test' }) : await declared;

${TEST_NAME_PLUGIN_SOURCE}

${LOAD_FAILURES_REPORTER_SOURCE}
${suite ? OWN_PROCESSES_PLUGIN_SOURCE : ''}
const projects = project.test?.projects ?? [];

const setup = resolve(${JSON.stringify(`${OUT}/mutant-setup.mjs`)});

const listed = (files) => (files === undefined ? [] : [files].flat());

export default {
    ...project,
    test: {
        ...project.test,
        coverage: { enabled: false },
        reporters: [loadFailures],
        projects: ${kept}.map((one) =>
            mergeConfig(
                { ...one, test: { ...one.test, setupFiles: [setup, ...listed(one.test?.setupFiles)] } },
                { plugins: [strykerTestNames${suite ? ', ownProcesses' : ''}], test: { exclude: ${JSON.stringify(exclude)}, isolate: true } },
            ),
        ),
    },
};
`;
}
