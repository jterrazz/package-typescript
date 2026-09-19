import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';

/*
 * A chain with a STUB checker, for the reason the member pass has one: the
 * `--format json` this reads arrives in a release of @jterrazz/test that is
 * not out, so the only ground that proves the code path today is a binary on
 * the project's own `node_modules/.bin` that answers it.
 *
 * The claim is the ratchet's, not the checker's: one flat file records both
 * reporters, the checker's findings under the namespace its own codes carry,
 * and every refusal the file already made for an oxlint rule it makes for a
 * `jterrazz-check` one.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');

let project = '';

/** A checker whose `--format json` reports exactly the findings given. */
function stubReporting(findings: { code: string }[]): string {
    return `#!/usr/bin/env node
if (process.argv.includes('--format')) {
    process.stdout.write(${JSON.stringify(JSON.stringify({ diagnostics: findings }))});
}
process.exit(0);
`;
}

/** Rewrite the stub so the next run reports a different tree. */
function reporting(...codes: string[]): void {
    const binary = join(project, 'node_modules/.bin/jterrazz-test-check');
    writeFileSync(
        binary,
        stubReporting(
            codes.map((code) => ({
                code,
                file: 'specs/http/response.spec.yaml',
                line: 3,
                message: 'the token is not one the grammar knows',
                severity: 'error',
            })),
        ),
    );
    chmodSync(binary, 0o755);
}

beforeEach(() => {
    project = mkdtempSync(resolve(tmpdir(), 'spec-baseline-checker-'));
    writeFileSync(
        join(project, 'package.json'),
        `${JSON.stringify({ name: 'spec-baseline-checker', private: true, type: 'module', version: '1.0.0' }, null, 2)}\n`,
    );
    writeFileSync(
        join(project, 'tsconfig.json'),
        '{ "compilerOptions": { "strict": true, "noEmit": true, "skipLibCheck": true }, "include": ["index.ts"] }\n',
    );
    writeFileSync(
        join(project, 'oxlint.config.ts'),
        "export default { ignorePatterns: ['node_modules/**'], plugins: ['unicorn'], rules: {} };\n",
    );
    writeFileSync(join(project, 'index.ts'), 'export const value = 1;\n');

    const installed = join(project, 'node_modules/@jterrazz/test');
    mkdirSync(installed, { recursive: true });
    writeFileSync(
        join(installed, 'package.json'),
        `${JSON.stringify({ name: '@jterrazz/test', version: '15.3.0' }, null, 2)}\n`,
    );
    mkdirSync(join(project, 'node_modules/.bin'), { recursive: true });

    reporting('jterrazz-check(d4)', 'jterrazz-check(d4)', 'jterrazz-check(c9)');
});

afterEach(() => {
    rmSync(project, { force: true, recursive: true });
    project = '';
});

/**
 * One run of the product command in the project. `INIT_CWD` is named because
 * npm sets it for whatever script started this suite, and `baseline` reads it
 * as the project it records — a runner's variable would send the write here.
 */
function run(command: string): { status: null | number; stdout: string } {
    const result = spawnSync('bash', [BIN, command], {
        cwd: project,
        encoding: 'utf8',
        env: { ...process.env, INIT_CWD: project },
    });

    return { status: result.status, stdout: result.stdout };
}

/** The recorded file, as the ratchet wrote it. */
function recorded(): Record<string, number> {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the file is this command's own output, one line above
    return JSON.parse(readFileSync(join(project, 'oxlint.baseline.json'), 'utf8')) as Record<
        string,
        number
    >;
}

test('records the checker findings beside the linter, under their own namespace', () => {
    // Given - a project whose checker reports three findings across two ids
    // When - the baseline is recorded
    run('baseline');

    // Then - one flat file carries both reporters, keyed by the code each one prints
    expect(recorded()).toStrictEqual({ 'jterrazz-check/c9': 1, 'jterrazz-check/d4': 2 });
});

test('holds the run where the checker reports exactly what was recorded', () => {
    // Given - a recorded baseline and a tree that has not moved
    run('baseline');

    // When - the checks run
    const { stdout } = run('check');

    // Then - the ratchet says nothing
    expect(stdout).not.toContain('baseline-ratchet');
});

test('refuses a checker id that grew, one nobody recorded, and one that reached zero', () => {
    // Given - a recorded baseline
    run('baseline');

    // When - the same id reports once more
    reporting(
        'jterrazz-check(d4)',
        'jterrazz-check(d4)',
        'jterrazz-check(d4)',
        'jterrazz-check(c9)',
    );

    // Then - the debt grew, and the ratchet names the id and both numbers
    expect(run('check').stdout).toContain('jterrazz-check/d4 is at 3, above its baseline of 2');

    // When - an id nobody recorded reports
    reporting(
        'jterrazz-check(d4)',
        'jterrazz-check(d4)',
        'jterrazz-check(c9)',
        'jterrazz-check(b5)',
    );

    // Then - it is new debt
    expect(run('check').stdout).toContain('jterrazz-check/b5 has 1 diagnostic(s) and no entry');

    // When - an id is paid off
    reporting('jterrazz-check(d4)', 'jterrazz-check(d4)');

    // Then - the entry is owed a deletion, which is what makes the file shrink
    expect(run('check').stdout).toContain('jterrazz-check/c9 is at zero');
});
