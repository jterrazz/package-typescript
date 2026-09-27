import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses, SELECTING_BIN } from '../_setup/check-passes.js';
import { temporaryDirectory } from '../_setup/temporary-directory.js';

// `node_modules` is gitignored at this repository's root, so every install the walk resolves is built here.
// The stubs exit 1 unless a case asks otherwise: a passing pass prints nothing, which would leave the claim unmade.

const FIXTURE = resolve(import.meta.dirname, '_fixtures/checker-member');

// It runs no oxlint of its own: it reports whether the handed report is there and its `jterrazz(*)` count.
function stub(name: string, exit: 0 | 1): string {
    return `#!/usr/bin/env node
const { readFileSync } = require('node:fs');
const args = process.argv.slice(2);
const member = args.indexOf('--member');
const flag = args.indexOf('--oxlint-report');
function reportOf() {
    if (flag === -1) return 'none';
    try {
        const { diagnostics } = JSON.parse(readFileSync(args[flag + 1], 'utf8'));
        if (!Array.isArray(diagnostics)) return 'unreadable';
        const plugin = diagnostics.filter(({ code }) => String(code).startsWith('jterrazz(')).length;
        return \`read, \${plugin} jterrazz\`;
    } catch {
        return 'unreadable';
    }
}
process.stdout.write(
    member === -1
        ? \`${name} tree pass: \${args[0]} (oxlint report: \${reportOf()})\\n\`
        : \`${name} member pass: \${args[member + 1]} (oxlint report: \${reportOf()})\\n\`,
);
process.exit(${exit});
`;
}

function install(dir: string, version: string, name: string, exit: 0 | 1 = 1): void {
    const installed = join(dir, 'node_modules/@jterrazz/test');
    mkdirSync(join(installed, 'dist'), { recursive: true });
    writeFileSync(
        join(installed, 'package.json'),
        `${JSON.stringify({ bin: { 'jterrazz-test-check': 'dist/checker.js' }, name: '@jterrazz/test', version }, null, 2)}\n`,
    );
    writeFileSync(join(installed, 'dist/checker.js'), stub(name, exit));
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
        "export default { ignorePatterns: ['plugin.mjs'], jsPlugins: ['./plugin.mjs'], rules: { 'jterrazz/flags-once': 'error' } };\n",
    );
}

function check(dir: string): { status: null | number; stdout: string } {
    const result = spawnSync('node', [SELECTING_BIN, 'check'], {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env, ...onlyPasses('conventions') },
    });

    return { status: result.status, stdout: result.stdout };
}

function workspace(version: string, exit: 0 | 1 = 1): string {
    const workDir = temporaryDirectory('spec-checker-member-');
    cpSync(FIXTURE, workDir, { recursive: true });
    install(workDir, version, 'root', exit);

    return workDir;
}

describe('checker-member', () => {
    test('runs the member pass once per member that resolves @jterrazz/test', () => {
        // Given - a workspace whose only declaration is the root's, one member with specs and one without
        // When - the quality checks run at the root
        const { status, stdout } = check(workspace('17.0.0'));

        // Then - every member is asked, the one that owns no specs/ included
        expect(stdout).toContain('root member pass: . ');
        expect(stdout).toContain('root member pass: apps/api');
        expect(stdout).toContain('root member pass: apps/web');

        // Then - and the tree pass still runs per specs root, on a member that declares nothing
        expect(stdout).toContain('root tree pass: apps/api/specs');
        expect(status).toBe(1);
    });

    test("hands no member run an oxlint report: the plugin's diagnostics are oxlint's to judge", () => {
        // Given - a workspace whose root resolves a checker that answers the member flag, and arms a plugin rule reporting once
        const root = workspace('17.0.0');
        armPlugin(root);

        // When - the quality checks run at the root
        const { stdout } = check(root);

        // Then - every member run and the tree run count their own findings, and read no report
        expect(stdout).toContain('root member pass: . (oxlint report: none)');
        expect(stdout).toContain('root member pass: apps/api (oxlint report: none)');
        expect(stdout).toContain('root member pass: apps/web (oxlint report: none)');
        expect(stdout).toContain('root tree pass: apps/api/specs (oxlint report: none)');
    });

    test('passes a conventions run whose checker passes, and runs no linter for it', () => {
        // Given - a workspace whose checker passes, and whose armed plugin would fail the linter
        const root = workspace('17.0.0', 0);
        armPlugin(root);

        // When - the conventions pass alone runs at the root
        const { status, stdout } = check(root);

        // Then - the conventions pass is its own verdict: the linter neither runs nor weighs
        expect(stdout).toContain('Test Conventions (@jterrazz/test)');
        expect(stdout).not.toContain('Oxlint Check');
        expect(stdout).toContain('All checks passed');
        expect(status).toBe(0);
    });

    test('runs the checker a member resolves, not the one the root hoisted', () => {
        // Given - a member carrying its own nested install beside the root's
        const root = workspace('17.0.0');
        install(join(root, 'apps/api'), '17.0.0', 'nested');

        // When - the quality checks run at the root
        const { stdout } = check(root);

        // Then - the member is judged by its own binary, and every other one by the root's
        expect(stdout).toContain('nested member pass: apps/api');
        expect(stdout).not.toContain('root member pass: apps/api');
        expect(stdout).toContain('root member pass: apps/web');
    });

    test('never makes a consumer of a project by what the tree around it installed', () => {
        // Given - a repository checked out inside another tree that installs @jterrazz/test
        const workDir = temporaryDirectory('spec-checker-boundary-');
        install(workDir, '17.0.0', 'outer');
        const project = join(workDir, 'project');
        mkdirSync(join(project, 'specs'), { recursive: true });
        writeFileSync(join(project, '.git'), 'gitdir: /nowhere\n');
        writeFileSync(
            join(project, 'package.json'),
            `${JSON.stringify({ name: 'spec-checker-boundary', private: true }, null, 2)}\n`,
        );
        writeFileSync(join(project, 'specs/index.test.ts'), 'export const value = 1;\n');

        // When - the quality checks run inside it
        const { stdout } = check(project);

        // Then - the pass does not exist: the install above the boundary is another project's
        expect(stdout).not.toContain('Test Conventions');
        expect(stdout).not.toContain('outer');
    });
});
