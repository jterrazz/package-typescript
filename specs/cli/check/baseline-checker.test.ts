import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';

/*
 * A chain with a STUB checker, for the reason the member pass has one: the
 * `--format json` this reads arrives in a release of @jterrazz/test that is
 * not out, so the only ground that proves the code path today is an install
 * whose own `bin` entry answers it.
 *
 * The claim is the ratchet's, not the checker's: one flat file records both
 * reporters, the checker's findings under the namespace its own codes carry,
 * every refusal the file already made for an oxlint rule it makes for a
 * `jterrazz-check` one — and the pass that reports those findings is judged by
 * the file rather than by the binary's exit code, or recorded debt would fail
 * the run the ratchet just held.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');

let project = '';

/**
 * A checker reporting exactly the findings given: as JSON for the ratchet, and
 * as the human line a member pass prints — which FAILS, the way the real one
 * does when it has something to say. That failure is the point of the last
 * test: the run is green anyway, because the file records the debt.
 */
function stubReporting(findings: { code: string }[]): string {
    return `#!/usr/bin/env node
const findings = ${JSON.stringify(JSON.stringify({ diagnostics: findings }))};
if (process.argv.includes('--format')) {
    process.stdout.write(findings);
    process.exit(0);
}
for (const diagnostic of JSON.parse(findings).diagnostics) {
    process.stdout.write(\`\${diagnostic.code} \${diagnostic.file} \${diagnostic.message}\n\`);
}
process.exit(1);
`;
}

/** Rewrite the stub so the next run reports a different tree. */
function reporting(...codes: string[]): void {
    writeFileSync(
        join(project, 'node_modules/@jterrazz/test/dist/checker.js'),
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
    mkdirSync(join(installed, 'dist'), { recursive: true });
    writeFileSync(
        join(installed, 'package.json'),
        `${JSON.stringify({ bin: { 'jterrazz-test-check': 'dist/checker.js' }, name: '@jterrazz/test', version: '15.3.0' }, null, 2)}\n`,
    );

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

/** The verdict the report printed for one pass, or `absent` when it did not run. */
function verdict(stdout: string, label: string): string {
    const index = stdout.indexOf(label);

    return index === -1
        ? 'absent'
        : (/✓ Passed|✗ Failed/u.exec(stdout.slice(index))?.[0] ?? 'absent');
}

test('holds the pass that reported the debt, and prints what it is holding', () => {
    // Given - a recorded baseline, and a checker that fails its member pass on those same findings
    run('baseline');

    // When - the checks run
    const { stdout } = run('check');

    // Then - both passes the one file judges are green, and the findings are on the page anyway
    expect(verdict(stdout, 'Test Conventions')).toBe('✓ Passed');
    expect(verdict(stdout, 'Oxlint Check')).toBe('✓ Passed');
    expect(stdout).toContain("oxlint.baseline.json is this pass's verdict too");
    expect(stdout).toContain('jterrazz-check(d4) specs/http/response.spec.yaml');
});

test('enrols a second reporter with one line, not a refusal per finding', () => {
    // Given - a baseline that predates the checker: recorded, but with no jterrazz-check/* key
    writeFileSync(join(project, 'oxlint.baseline.json'), '{}\n');

    // When - check runs against a checker reporting three findings across two ids
    const { stdout } = run('check');

    // Then - one line names the gesture instead of a refusal per finding
    expect(stdout).toContain(
        "oxlint.baseline.json records one reporter — run 'typescript baseline' once to enrol @jterrazz/test's 3 finding(s)",
    );
    expect(stdout).not.toContain('has 1 diagnostic(s) and no entry');
    expect(stdout).not.toContain('has 2 diagnostic(s) and no entry');
});

test('sets the checker entries aside on a run that could not measure them', () => {
    // Given - a baseline recorded with the checker's ids in it
    run('baseline');

    // When - the install drops below the release that answers `--format json`
    writeFileSync(
        join(project, 'node_modules/@jterrazz/test/package.json'),
        `${JSON.stringify({ bin: { 'jterrazz-test-check': 'dist/checker.js' }, name: '@jterrazz/test', version: '15.2.0' }, null, 2)}\n`,
    );

    // Then - nothing measured them, so nothing says their debt reached zero
    expect(run('check').stdout).not.toContain('is at zero');
});
