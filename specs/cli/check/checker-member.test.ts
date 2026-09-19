import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

/*
 * A chain, not a document, and a STUB checker rather than the real one. The
 * pass under test is gated on a release of @jterrazz/test that is not out yet:
 * the binary installed here answers no `--member` flag, so the only way to
 * prove the code path today is to put a binary that does on the ground the
 * product command reads it from — the project's own `node_modules/.bin`, which
 * is where a consumer's checker lives and where the lookup now starts.
 *
 * The ground carries what a fixture cannot: `node_modules` is gitignored at
 * this repository's root, so the install the walk resolves is built here.
 *
 * The stub exits 1 on purpose. A passing pass prints nothing — that is the
 * report's contract — so a stub that succeeded would leave the claim unmade.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');
const FIXTURE = resolve(import.meta.dirname, '_fixtures/checker-member');

/** A checker that answers `--member`, and says which shape it was run in. */
const STUB = `#!/usr/bin/env node
const args = process.argv.slice(2);
const member = args.indexOf('--member');
process.stdout.write(
    member === -1
        ? \`stub tree pass: \${args[0]}\\n\`
        : \`stub member pass: \${args[member + 1]}\\n\`,
);
process.exit(1);
`;

let workDir = '';

afterEach(() => {
    if (workDir) {
        rmSync(workDir, { force: true, recursive: true });
        workDir = '';
    }
});

/** The workspace, with a @jterrazz/test of `version` installed at its root. */
function checkWorkspace(version: string): { status: null | number; stdout: string } {
    workDir = mkdtempSync(resolve(tmpdir(), 'spec-checker-member-'));
    cpSync(FIXTURE, workDir, { recursive: true });

    const installed = join(workDir, 'node_modules/@jterrazz/test');
    mkdirSync(installed, { recursive: true });
    writeFileSync(
        join(installed, 'package.json'),
        `${JSON.stringify({ name: '@jterrazz/test', version }, null, 2)}\n`,
    );

    const bin = join(workDir, 'node_modules/.bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'jterrazz-test-check'), STUB);
    chmodSync(join(bin, 'jterrazz-test-check'), 0o755);

    const result = spawnSync('bash', [BIN, 'check'], { cwd: workDir, encoding: 'utf8' });

    return { status: result.status, stdout: result.stdout };
}

describe('the conventions checker in a workspace', () => {
    test('runs the member pass once per member that resolves @jterrazz/test', () => {
        // Given - a workspace whose only declaration is the root's, one member with specs and one without
        // When - the quality checks run at the root
        const { status, stdout } = checkWorkspace('15.3.0');

        // Then - every member is asked, the one that owns no specs/ included
        expect(stdout).toContain('stub member pass: .');
        expect(stdout).toContain('stub member pass: apps/api');
        expect(stdout).toContain('stub member pass: apps/web');

        // Then - and the tree pass still runs per specs root, on a member that declares nothing
        expect(stdout).toContain('stub tree pass: apps/api/specs');
        expect(status).toBe(1);
    });

    test('says the member pass is dormant where the installed release is older', () => {
        // Given - the same workspace on a release that answers no --member flag
        // When - the quality checks run at the root
        const { stdout } = checkWorkspace('15.2.0');

        // Then - the tree pass still runs, and the pass says once what it did not ask
        expect(stdout).toContain('stub tree pass: apps/api/specs');
        expect(stdout).not.toContain('stub member pass');
        expect(stdout).toContain('the member pass needs @jterrazz/test 15.3.0');
    });
});
