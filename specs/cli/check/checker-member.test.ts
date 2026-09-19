import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

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
const FIXTURE = resolve(import.meta.dirname, '_fixtures/checker-member');

/** A checker that answers `--member`, and says under which name it was run. */
function stub(name: string): string {
    return `#!/usr/bin/env node
const args = process.argv.slice(2);
const member = args.indexOf('--member');
process.stdout.write(
    member === -1
        ? \`${name} tree pass: \${args[0]}\\n\`
        : \`${name} member pass: \${args[member + 1]}\\n\`,
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

describe('the conventions checker in a workspace', () => {
    test('runs the member pass once per member that resolves @jterrazz/test', () => {
        // Given - a workspace whose only declaration is the root's, one member with specs and one without
        // When - the quality checks run at the root
        const { status, stdout } = check(workspace('15.3.0'));

        // Then - every member is asked, the one that owns no specs/ included
        expect(stdout).toContain('root member pass: .');
        expect(stdout).toContain('root member pass: apps/api');
        expect(stdout).toContain('root member pass: apps/web');

        // Then - and the tree pass still runs per specs root, on a member that declares nothing
        expect(stdout).toContain('root tree pass: apps/api/specs');
        expect(status).toBe(1);
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
});
