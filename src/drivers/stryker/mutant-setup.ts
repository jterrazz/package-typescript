import { MUTATION_OUTPUT } from '../../../lint/kit/project/build-plan.js';
import { SOURCES_RAN_SOURCE } from './sources-ran.js';

export const RAN_BY_TESTS_VARIABLE = '__TYPESCRIPT_MUTATION_RAN_BY_TESTS__';

export const OBSERVED_TESTS_VARIABLE = '__TYPESCRIPT_MUTATION_OBSERVED_TESTS__';

// invariant: first of every project's setup files — a mutant is live before the test file loads, and a static mutant is credited to every test of each file whose loading ran it; the mutants a test ran in its own process, beyond loading its file, are written where RAN_BY_TESTS_VARIABLE names; what a process it spawned ran stays apart, since a child's loading and its calls cannot be told apart.
// invariant: what each test's processes ran is written where OBSERVED_TESTS_VARIABLE names: the sources whose functions they ran and the sources of every script they loaded — none for a test no process started for, while it ran, while its file loaded or between its tests, and no record of either for a test one of whose processes V8 would not profile or died before it could hand back what it ran.
export const MUTANT_SETUP_SOURCE = `import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { SourceMap } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { threadId } from 'node:worker_threads';
import { afterAll, afterEach, beforeEach, inject } from 'vitest';

${SOURCES_RAN_SOURCE}

const ns = globalThis.__stryker__ ?? (globalThis.__stryker__ = {});

if (inject('mode') === 'mutant') {
    ns.activeMutant = String(inject('activeMutant'));
    process.env.__STRYKER_ACTIVE_MUTANT__ = ns.activeMutant;
    delete process.env.__STRYKER_CHILD_COVERAGE__;
} else {
    delete process.env.__STRYKER_ACTIVE_MUTANT__;
    const children = join(process.cwd(), ${JSON.stringify(MUTATION_OUTPUT)}, 'children', \`\${process.pid}-\${threadId}\`);
    mkdirSync(children, { recursive: true });
    process.env.__STRYKER_CHILD_COVERAGE__ = children;
    const reporter = \`--require="\${join(process.cwd(), ${JSON.stringify(MUTATION_OUTPUT)}, 'child-coverage.cjs')}"\`;
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
    const merged = (into, functions) => {
        for (const [url, offsets] of functions) {
            const held = into.get(url) ?? new Set();
            for (const offset of offsets) {
                held.add(offset);
            }
            into.set(url, held);
        }
    };
    const alive = (name) => {
        try {
            process.kill(Number(name.split('-')[0]), 0);
            return true;
        } catch {
            return false;
        }
    };
    const drained = () => {
        const hits = {};
        const functions = new Map();
        let spawned = false;
        let blind = false;
        for (const name of readdirSync(children)) {
            const path = join(children, name);
            if (name.endsWith('.json')) {
                add(hits, JSON.parse(readFileSync(path, 'utf8')));
                rmSync(path);
            } else if (name.endsWith('.functions')) {
                merged(functions, Object.entries(JSON.parse(readFileSync(path, 'utf8'))));
                rmSync(path);
            } else if (name.endsWith('.started')) {
                spawned = true;
                rmSync(path);
            } else if (name.endsWith('.blind') || (name.endsWith('.alive') && !alive(name))) {
                blind = true;
                rmSync(path);
            }
        }
        return { blind, functions, hits, spawned };
    };
    const observed = new Map();
    const observedOf = (test) => observed.get(test) ?? observed.set(test, { blind: false, functions: new Map(), spawned: false }).get(test);
    const observe = (into, { blind, functions, spawned }) => {
        into.blind ||= blind;
        into.spawned ||= spawned;
        merged(into.functions, functions);
    };
    let asked = 0;
    const flushed = async () => {
        asked += 1;
        writeFileSync(join(children, 'flush'), String(asked));
        const deadline = Date.now() + 1000;
        while (Date.now() < deadline) {
            const living = readdirSync(children)
                .filter((name) => name.endsWith('.alive'))
                .map((name) => name.slice(0, -'.alive'.length))
                .filter((name) => alive(name));
            const answered = (name) => existsSync(join(children, \`\${name}.ack\`)) && readFileSync(join(children, \`\${name}.ack\`), 'utf8') === String(asked);
            if (living.every((name) => answered(name))) {
                return;
            }
            await pause(10);
        }
    };
    const nameOf = (task) => {
        const parts = [task.name];
        for (let suite = task.suite; suite; suite = suite.suite) {
            parts.unshift(suite.name);
        }
        return \`\${task.file?.filepath ?? 'unknown.js'}#\${parts.join(' ').trim()}\`;
    };
    const fileWide = {};
    const fileObserved = { blind: false, functions: new Map(), spawned: false };
    const between = () => {
        const run = drained();
        add(fileWide, run.hits);
        observe(fileObserved, run);
    };

    beforeEach(({ task }) => {
        between();
        current = nameOf(task);
        tests.add(current);
    });

    afterEach(async () => {
        await flushed();
        const perTest = coverage().perTest;
        for (const id of Object.keys(perTest[current] ?? {})) {
            ranByTests.add(id);
        }
        const run = drained();
        add(perTest[current] ?? (perTest[current] = {}), run.hits);
        observe(observedOf(current), run);
    });

    afterAll(({}, suite) => {
        between();
        const { perTest, static: statics } = coverage();
        const ranInto = process.env.${RAN_BY_TESTS_VARIABLE};
        if (ranInto !== undefined) {
            mkdirSync(ranInto, { recursive: true });
            writeFileSync(join(ranInto, \`\${process.pid}-\${threadId}-\${Math.random().toString(36).slice(2)}.txt\`), [...ranByTests].join('\\n'));
        }
        const observedInto = process.env.${OBSERVED_TESTS_VARIABLE};
        if (observedInto !== undefined) {
            const root = process.cwd();
            let own;
            try {
                own = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name;
            } catch {}
            const records = [...tests].map((test) => {
                const [file, ...name] = test.split('#');
                const one = { blind: fileObserved.blind, functions: new Map(), spawned: fileObserved.spawned };
                observe(one, fileObserved);
                observe(one, observedOf(test));
                const ran = !one.spawned ? { loaded: [], ran: [] } : one.blind ? undefined : sourcesRan(one.functions, root, own);
                return { test: \`\${relative(root, file)}#\${name.join('#')}\`, ...ran };
            });
            mkdirSync(observedInto, { recursive: true });
            writeFileSync(join(observedInto, \`\${process.pid}-\${threadId}-\${Math.random().toString(36).slice(2)}.json\`), JSON.stringify(records));
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
