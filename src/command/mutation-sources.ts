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

// invariant: every process a test spawns runs the instrumented build with this module imported first: it reports, on its way out, the mutants it ran — the parent credits them to the test that spawned it.
export const CHILD_COVERAGE_SOURCE = `const { renameSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const into = process.env.__STRYKER_CHILD_COVERAGE__;

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
    const path = join(into, \`\${process.pid}-\${Date.now()}-\${Math.random().toString(36).slice(2)}.json\`);
    writeFileSync(\`\${path}.partial\`, JSON.stringify(hits));
    renameSync(\`\${path}.partial\`, path);
}

process.on('exit', report);
`;

// invariant: first of every project's setup files — a mutant is live before the test file loads, and a static mutant is credited to every test of each file whose loading ran it.
export const MUTANT_SETUP_SOURCE = `import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
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
    const reporter = \`--require=\${join(process.cwd(), ${JSON.stringify(OUT)}, 'child-coverage.cjs')}\`;
    if (!(process.env.NODE_OPTIONS ?? '').includes(reporter)) {
        process.env.NODE_OPTIONS = \`\${process.env.NODE_OPTIONS ?? ''} \${reporter}\`.trim();
    }

    const coverage = () => ns.mutantCoverage ?? (ns.mutantCoverage = { perTest: {}, static: {} });
    const loaded = { ...coverage().static };
    const tests = new Set();
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
        add(perTest[current] ?? (perTest[current] = {}), drained());
    });

    afterAll(({}, suite) => {
        add(fileWide, drained());
        const { perTest, static: statics } = coverage();
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

const projects = project.test?.projects ?? [];

const setup = resolve(${JSON.stringify(`${OUT}/mutant-setup.mjs`)});

const listed = (files) => (files === undefined ? [] : [files].flat());

export default {
    ...project,
    test: {
        ...project.test,
        coverage: { enabled: false },
        projects: ${kept}.map((one) =>
            mergeConfig(
                { ...one, test: { ...one.test, setupFiles: [setup, ...listed(one.test?.setupFiles)] } },
                { plugins: [strykerTestNames], test: { exclude: ${JSON.stringify(exclude)}, isolate: true } },
            ),
        ),
    },
};
`;
}
