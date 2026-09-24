import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';

/*
 * A chain, not a document, and a STUB checker rather than the real one. The
 * pass under test is gated on a release of @jterrazz/test that is not out yet:
 * the binary installed here answers no `--member` flag, so the only way to
 * prove the code path today is to put one that does where the product command
 * reads it from — the `bin` entry of the install the directory RESOLVES.
 *
 * The ground carries what a fixture cannot: `node_modules` is gitignored at
 * this repository's root, so every install the walk resolves is built here.
 *
 * The stubs exit 1 on purpose. A passing pass prints nothing — that is the
 * report's contract — so a stub that succeeded would leave the claim unmade.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');
const FIXTURE = resolve(import.meta.dirname, 'fixtures/checker-member');

/**
 * A checker that answers `--member`, and says under which name it was run —
 * and, for a member run, whether the oxlint report it was handed is there to
 * read and how many `jterrazz(*)` diagnostics it carries, since it runs no
 * oxlint of its own and judges exactly those.
 */
function stub(name: string): string {
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
process.exit(1);
`;
}

/** An install of @jterrazz/test under `dir`, publishing the checker as its bin. */
function install(dir: string, version: string, name: string): void {
    const installed = join(dir, 'node_modules/@jterrazz/test');
    mkdirSync(join(installed, 'dist'), { recursive: true });
    writeFileSync(
        join(installed, 'package.json'),
        `${JSON.stringify({ bin: { 'jterrazz-test-check': 'dist/checker.js' }, name: '@jterrazz/test', version }, null, 2)}\n`,
    );
    writeFileSync(join(installed, 'dist/checker.js'), stub(name));
}

let workDir = '';

afterEach(() => {
    if (workDir) {
        rmSync(workDir, { force: true, recursive: true });
        workDir = '';
    }
});

/** A plugin under the name @jterrazz/test ships, reporting once, on apps/web's one source file. */
const PLUGIN = `export default {
    meta: { name: 'jterrazz' },
    rules: {
        'x1-once': {
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

/** The plugin armed in the workspace's own oxlint config, so the check's report carries one of its diagnostics. */
function armPlugin(dir: string): void {
    writeFileSync(join(dir, 'plugin.mjs'), PLUGIN);
    writeFileSync(
        join(dir, 'oxlint.config.ts'),
        "export default { ignorePatterns: ['plugin.mjs'], jsPlugins: ['./plugin.mjs'], rules: { 'jterrazz/x1-once': 'error' } };\n",
    );
}

/** One run of the product command in `dir`. */
function check(dir: string): { status: null | number; stdout: string } {
    const result = spawnSync('bash', [BIN, 'check'], { cwd: dir, encoding: 'utf8' });

    return { status: result.status, stdout: result.stdout };
}

/** The fixture workspace, with a @jterrazz/test of `version` at its root. */
function workspace(version: string): string {
    workDir = mkdtempSync(resolve(tmpdir(), 'spec-checker-member-'));
    cpSync(FIXTURE, workDir, { recursive: true });
    install(workDir, version, 'root');

    return workDir;
}

test('runs the member pass once per member that resolves @jterrazz/test', () => {
    // Given - a workspace whose only declaration is the root's, one member with specs and one without
    // When - the quality checks run at the root
    const { status, stdout } = check(workspace('15.3.0'));

    // Then - every member is asked, the one that owns no specs/ included
    expect(stdout).toContain('root member pass: . ');
    expect(stdout).toContain('root member pass: apps/api');
    expect(stdout).toContain('root member pass: apps/web');

    // Then - and the tree pass still runs per specs root, on a member that declares nothing
    expect(stdout).toContain('root tree pass: apps/api/specs');
    expect(status).toBe(1);
});

test('hands every member run the oxlint report the check wrote, and the tree runs none', () => {
    // Given - a workspace whose root resolves a checker that answers the member flag, and arms a plugin rule reporting once
    const root = workspace('15.3.0');
    armPlugin(root);

    // When - the quality checks run at the root
    const { stdout } = check(root);

    // Then - each member run reads the one report the oxlint pass wrote, complete, the plugin's diagnostic in it
    expect(stdout).toContain('root member pass: . (oxlint report: read, 1 jterrazz)');
    expect(stdout).toContain('root member pass: apps/api (oxlint report: read, 1 jterrazz)');
    expect(stdout).toContain('root member pass: apps/web (oxlint report: read, 1 jterrazz)');

    // Then - and the tree run, which reads no oxlint diagnostic, is handed nothing
    expect(stdout).toContain('root tree pass: apps/api/specs (oxlint report: none)');
});

test('says which member resolves a release too old to answer the flag', () => {
    // Given - the same workspace on a release that answers no --member flag
    // When - the quality checks run at the root
    const { stdout } = check(workspace('15.2.0'));

    // Then - the tree pass still runs, and the pass names the version rather than a count
    expect(stdout).toContain('root tree pass: apps/api/specs');
    expect(stdout).not.toContain('root member pass');
    expect(stdout).toContain('the member pass needs @jterrazz/test 15.3.0');
    expect(stdout).toContain('resolves 15.2.0');
});

test('runs the checker a member resolves, not the one the root hoisted', () => {
    // Given - a member carrying its own nested install beside the root's
    const root = workspace('15.3.0');
    install(join(root, 'apps/api'), '15.3.0', 'nested');

    // When - the quality checks run at the root
    const { stdout } = check(root);

    // Then - the member is judged by its own binary, and every other one by the root's
    expect(stdout).toContain('nested member pass: apps/api');
    expect(stdout).not.toContain('root member pass: apps/api');
    expect(stdout).toContain('root member pass: apps/web');
});

test('never makes a consumer of a project by what the tree around it installed', () => {
    // Given - a repository checked out inside another tree that installs @jterrazz/test
    workDir = mkdtempSync(resolve(tmpdir(), 'spec-checker-boundary-'));
    install(workDir, '15.3.0', 'outer');
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
