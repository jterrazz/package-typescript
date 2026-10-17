import { join } from 'node:path';

import { DIST, MUTATION_OUTPUT } from '../../../lint/kit/project/build-plan.js';

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

// outside: Vitest runs the slowest file first, and Stryker stops a mutant's run at the first test that fails; the file the last run took least time over runs first, so a mutant a quick test detects never waits on a slow one.
export const FASTEST_FIRST_SOURCE = `class FastestFirst extends BaseSequencer {
    async sort(files) {
        const took = (file) => this.ctx.cache.getFileTestResults(\`\${file.project.name}:\${relative(this.ctx.config.root, file.moduleId)}\`)?.duration ?? Number.POSITIVE_INFINITY;
        return [...files].sort((a, b) => took(a) - took(b) || 0);
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

export function vitestConfigSource(exclude: readonly string[], suite: boolean): string {
    const kept = suite
        ? 'projects.filter((project) => project.test?.browser?.enabled !== true)'
        : "projects.filter((project) => project.test?.name === 'unit')";

    return `import { relative, resolve } from 'node:path';

import { mergeConfig } from 'vitest/config';
import { BaseSequencer } from 'vitest/node';

import declared from '../../vitest.config.ts';

const project = typeof declared === 'function' ? await declared({ command: 'serve', mode: 'test' }) : await declared;

${TEST_NAME_PLUGIN_SOURCE}

${FASTEST_FIRST_SOURCE}

${LOAD_FAILURES_REPORTER_SOURCE}
${suite ? OWN_PROCESSES_PLUGIN_SOURCE : ''}
const projects = project.test?.projects ?? [];

const setup = resolve(${JSON.stringify(`${MUTATION_OUTPUT}/mutant-setup.mjs`)});

const listed = (files) => (files === undefined ? [] : [files].flat());

export default {
    ...project,
    test: {
        ...project.test,
        coverage: { enabled: false },
        reporters: [loadFailures],
        sequence: { ...project.test?.sequence, sequencer: FastestFirst },
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
