import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses, passOf, SELECTING_BIN } from '../_setup/check-passes.js';
import { temporaryDirectory } from '../_setup/temporary-directory.js';

// The stubs fail unless a case asks otherwise: a passing pass prints nothing, which would leave the claim unmade.

const FIXTURE = resolve(import.meta.dirname, '_fixtures/presets-member');

function contribution(name: string, exit: 0 | 1): string {
    return `export default {
    passes: {
        async conventions() {
            return {
                valued: ['--member'],
                check(context) {
                    const member = context.value('--member');
                    const said = member === undefined
                        ? \`${name} tree pass: \${context.positionals[0]}\`
                        : \`${name} member pass: \${member}\`;

                    return { failed: ${String(exit === 1)}, lines: [said] };
                },
            };
        },
    },
};
`;
}

function declare(dir: string, name: string, exit: 0 | 1 = 1): void {
    writeFileSync(join(dir, 'conventions.mjs'), contribution(name, exit));
    writeFileSync(
        join(dir, 'jterrazz.config.ts'),
        `export default {
    presets: [
        {
            checker: { label: 'Stub Conventions', module: new URL('./conventions.mjs', import.meta.url).pathname },
            name: 'stub',
            package: 'stub',
        },
    ],
};
`,
    );
}

const PLUGIN = `export default {
    meta: { name: 'jterrazz' },
    rules: {
        'flags-once': {
            create(context) {
                return {
                    Program(node) {
                        if (context.filename.endsWith('apps/web/src/index.ts')) {
                            context.report({ message: 'reported by the stub plugin', node });
                        }
                    },
                };
            },
        },
    },
};
`;

function armPlugin(dir: string): void {
    writeFileSync(join(dir, 'plugin.mjs'), PLUGIN);
    writeFileSync(
        join(dir, 'oxlint.config.ts'),
        "export default { ignorePatterns: ['plugin.mjs', 'conventions.mjs'], jsPlugins: ['./plugin.mjs'], rules: { 'jterrazz/flags-once': 'error' } };\n",
    );
}

function check(dir: string): { status: null | number; stdout: string } {
    const result = spawnSync('node', [SELECTING_BIN, 'check'], {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env, ...onlyPasses('presets') },
    });

    return { status: result.status, stdout: result.stdout };
}

function workspace(exit: 0 | 1 = 1): string {
    const workDir = temporaryDirectory('spec-presets-member-');
    cpSync(FIXTURE, workDir, { recursive: true });
    declare(workDir, 'root', exit);

    return workDir;
}

const WRITING = `export default {
    commands: {
        async baseline() {
            return () => {
                process.stdout.write('the stub recorded its section\\n');

                return 0;
            };
        },
    },
    passes: {
        async conventions() {
            return {
                valued: ['--member'],
                check(context) {
                    return context.fix && context.value('--member') === '.'
                        ? { writes: [{ path: 'written.ts', text: 'export const  written =1\\n' }] }
                        : {};
                },
            };
        },
    },
};
`;

function run(
    dir: string,
    command: string,
    passes: string,
): { status: null | number; stdout: string } {
    const result = spawnSync('node', [SELECTING_BIN, command], {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env, INIT_CWD: dir, TYPESCRIPT_CHECK_PASSES: passes },
    });

    return { status: result.status, stdout: result.stdout };
}

describe('presets-member', () => {
    test("fixes with a preset's checks first, so the formatter formats what they wrote", () => {
        // Given - a preset whose fixing run writes an unformatted module
        const root = workspace();
        writeFileSync(join(root, 'conventions.mjs'), WRITING);

        // When - the fixes run
        run(root, 'fix', 'presets,oxfmt');

        // Then - the module the preset wrote stands in the formatter's shape
        expect(readFileSync(join(root, 'written.ts'), 'utf8')).toBe('export const written = 1;\n');
    });

    test("records a preset's own section when the baseline is recorded", () => {
        // Given - a preset whose checks name a baseline command
        const root = workspace();
        writeFileSync(join(root, 'conventions.mjs'), WRITING);

        // When - the baseline is recorded
        const { stdout } = run(root, 'baseline', 'presets');

        // Then - the preset recorded its own section
        expect(stdout).toContain('the stub recorded its section');
    });

    test("runs a declared preset's checks once per member, and once per specs root", () => {
        // Given - a workspace whose only declaration is the root's, one member with specs and one without
        // When - the quality checks run at the root
        const { status, stdout } = check(workspace());

        // Then - every member is asked under the preset's own label, the one that owns no specs/ included, and the tree pass still runs per specs root
        expect(passOf(stdout, 'Stub Conventions')).toContain(
            'root tree pass: apps/api/specs\nroot member pass: .\nroot member pass: apps/api\nroot member pass: apps/web\n',
        );
        expect(status).toBe(1);
    });

    test("passes a preset's run whose checks pass, and runs no linter for it", () => {
        // Given - a workspace whose preset passes, and whose armed plugin would fail the linter
        const root = workspace(0);
        armPlugin(root);

        // When - the presets pass alone runs at the root
        const { status, stdout } = check(root);

        // Then - the preset's checks are their own verdict: the linter neither runs nor weighs
        expect(stdout).toContain('Stub Conventions');
        expect(stdout).not.toContain('Oxlint Check');
        expect(stdout).toContain('All checks passed');
        expect(status).toBe(0);
    });

    test('runs the preset a member declares, not the root one', () => {
        // Given - a member declaring its own preset beside the root's
        const root = workspace();
        declare(join(root, 'apps/api'), 'nested');

        // When - the quality checks run at the root
        const { stdout } = check(root);

        // Then - the member is judged by its own declaration, and every other one by the root's
        expect(stdout).toContain('nested member pass: apps/api');
        expect(stdout).not.toContain('root member pass: apps/api');
        expect(stdout).toContain('root member pass: apps/web');
    });

    test('stays out of a foreign tree vendored inside a member', () => {
        // Given - a member holding a vendored project of its own, a repository with its own specs
        const root = workspace();
        const vendored = join(root, 'apps/api/vendor/other-project');
        mkdirSync(join(vendored, 'specs'), { recursive: true });
        writeFileSync(join(vendored, '.git'), 'gitdir: /nowhere\n');
        writeFileSync(join(vendored, 'package.json'), '{ "name": "other-project" }\n');
        writeFileSync(join(vendored, 'specs/index.test.ts'), 'export const value = 1;\n');

        // When - the quality checks run at the root
        const { stdout } = check(root);

        // Then - the member's own specs are judged, and the vendored ones are another project's
        expect(passOf(stdout, 'Stub Conventions')).toContain(
            'root tree pass: apps/api/specs\nroot member pass: .\n',
        );
    });

    test('never judges a project by what the tree around it declares', () => {
        // Given - a repository checked out inside another tree that declares a preset
        const workDir = temporaryDirectory('spec-presets-boundary-');
        declare(workDir, 'outer');
        const project = join(workDir, 'project');
        mkdirSync(join(project, 'specs'), { recursive: true });
        writeFileSync(join(project, '.git'), 'gitdir: /nowhere\n');
        writeFileSync(
            join(project, 'package.json'),
            `${JSON.stringify({ name: 'spec-presets-boundary', private: true }, null, 2)}\n`,
        );
        writeFileSync(join(project, 'specs/index.test.ts'), 'export const value = 1;\n');

        // When - the quality checks run inside it
        const { stdout } = check(project);

        // Then - the pass does not exist: the declaration above the boundary is another project's
        expect(stdout).not.toContain('Stub Conventions');
        expect(stdout).not.toContain('outer');
    });
});
