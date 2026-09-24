import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

/*
 * A chain in a temp directory, for the two parts of the ground a fixture
 * cannot hold. The checker is a STUB installed as the project's
 * @jterrazz/test, under `node_modules/`, which git never tracks. And the config
 * arms a JS plugin named `jterrazz`, the name @jterrazz/test's own plugin holds
 * in this repository's config: oxlint refuses two plugins by one name in one
 * run, and @jterrazz/test's checker, run alone, walks this repository and loads
 * every config in it. The rest of the project — the stub plugin among it — is
 * the fixture `fixtures/baseline/ownership/`, so the pass's verdict is exactly
 * the exit code the stub was told to give.
 *
 * The claim is the ratchet's split: the `typescript` section of
 * `jterrazz.baseline.json` records and judges this package's rules only. A
 * `jterrazz(*)` diagnostic in oxlint's report and a `jterrazz-check(*)`
 * finding are @jterrazz/test's, in its `test` section of the same file —
 * never counted here, never forgiven here, and never rewritten here.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');

/** A checker that prints one finding and exits with the given code. */
function checker(exitCode: number): string {
    return `#!/usr/bin/env node
process.stdout.write('[error] specs/x.spec.ts:1: a finding the stub always reports (C9)\\n');
process.exit(${exitCode});
`;
}

/** The project's config: the stub plugin, armed. */
const CONFIG = `export default {
    ignorePatterns: ['node_modules/**', 'plugin.mjs'],
    jsPlugins: ['./plugin.mjs'],
    rules: { 'jterrazz/x1-every-file': 'error' },
};
`;

/** The fixture in a temp directory, with its config and a stub @jterrazz/test whose checker exits 0 — removed when the test ends. */
function groundOf(): string {
    const project = mkdtempSync(resolve(tmpdir(), 'spec-baseline-ownership-'));
    onTestFinished(() => {
        rmSync(project, { force: true, recursive: true });
    });
    cpSync(resolve(import.meta.dirname, 'fixtures/baseline/ownership'), project, {
        recursive: true,
    });
    writeFileSync(join(project, 'oxlint.config.ts'), CONFIG);
    const installed = join(project, 'node_modules/@jterrazz/test');
    mkdirSync(join(installed, 'dist'), { recursive: true });
    writeFileSync(
        join(installed, 'package.json'),
        `${JSON.stringify({ bin: { 'jterrazz-test-check': 'dist/checker.js' }, name: '@jterrazz/test', version: '17.0.0' }, null, 2)}\n`,
    );
    writeFileSync(join(installed, 'dist/checker.js'), checker(0));

    return project;
}

/**
 * One run of the product command in the project. `INIT_CWD` is named because
 * npm sets it for whatever script started this suite, and `baseline` reads it
 * as the project it records — a runner's variable would send the write here.
 */
function run(project: string, command: string): { status: null | number; stdout: string } {
    const result = spawnSync('bash', [BIN, command], {
        cwd: project,
        encoding: 'utf8',
        env: { ...process.env, INIT_CWD: project },
    });

    return { status: result.status, stdout: result.stdout };
}

/** The verdict the report printed for one pass, or `absent` when it did not run. */
function verdict(stdout: string, label: string): string {
    const index = stdout.indexOf(label);

    return index === -1
        ? 'absent'
        : (/✓ Passed|✗ Failed/u.exec(stdout.slice(index))?.[0] ?? 'absent');
}

describe('baseline-ownership', () => {
    test("records none of @jterrazz/test's diagnostics", () => {
        // Given - a tree whose only oxlint diagnostic is a `jterrazz(*)` one, beside one `debugger`
        const project = groundOf();
        writeFileSync(
            join(project, 'index.ts'),
            'export function stop(): void {\n    debugger;\n}\n',
        );

        // When - the baseline is recorded
        run(project, 'baseline');

        // Then - the section carries this package's rule and nothing of the plugin's
        const written = readFileSync(join(project, 'jterrazz.baseline.json'), 'utf8');
        expect(JSON.parse(written)).toStrictEqual({ typescript: { 'eslint/no-debugger': 1 } });
    });

    test("leaves @jterrazz/test's section byte for byte", () => {
        // Given - a test section on one line, keys unsorted, beside a stale typescript one and a debugger this package records
        const project = groundOf();
        const section = '{ "jterrazz/x1-every-file": 2, "jterrazz-check/c9": 1 }';
        writeFileSync(
            join(project, 'jterrazz.baseline.json'),
            `{\n  "test": ${section},\n  "typescript": { "eslint/no-var": 4 }\n}\n`,
        );
        writeFileSync(
            join(project, 'index.ts'),
            'export function stop(): void {\n    debugger;\n}\n',
        );

        // When - the baseline is recorded
        run(project, 'baseline');

        // Then - only this package's section moved, and the other one's bytes are the ones it wrote
        expect(readFileSync(join(project, 'jterrazz.baseline.json'), 'utf8')).toBe(
            `{\n    "test": ${section},\n    "typescript": {\n        "eslint/no-debugger": 1\n    }\n}\n`,
        );
    });

    test("hands the file it writes to the project's own formatter", () => {
        // Given - a project whose formatter indents with tabs, and one debugger
        const project = groundOf();
        writeFileSync(join(project, '.oxfmtrc.json'), '{ "useTabs": true }\n');
        writeFileSync(
            join(project, 'index.ts'),
            'export function stop(): void {\n    debugger;\n}\n',
        );

        // When - the baseline is recorded
        run(project, 'baseline');

        // Then - the file is in the project's shape, not the writer's two spaces nor the default's four
        expect(readFileSync(join(project, 'jterrazz.baseline.json'), 'utf8')).toBe(
            '{\n\t"typescript": {\n\t\t"eslint/no-debugger": 1\n\t}\n}\n',
        );
    });

    test('keeps the oxlint pass green when every diagnostic is a `jterrazz(*)` one', () => {
        // Given - no baseline, and a plugin that fails oxlint on every file
        const project = groundOf();
        // When - the checks run
        const { stdout } = run(project, 'check');

        // Then - oxlint's exit code is not the verdict: nothing this package owns was reported
        expect(verdict(stdout, 'Oxlint Check')).toBe('✓ Passed');
    });

    test("takes the checker's exit code as the Test Conventions verdict", () => {
        // Given - a checker that fails, and a recorded baseline beside it
        const project = groundOf();
        writeFileSync(join(project, 'node_modules/@jterrazz/test/dist/checker.js'), checker(1));
        run(project, 'baseline');

        // When - the checks run
        const { stdout } = run(project, 'check');

        // Then - this package's file forgives nothing of the checker's
        expect(verdict(stdout, 'Test Conventions')).toBe('✗ Failed');
        expect(stdout).toContain('a finding the stub always reports');
    });

    /** A green checker that answers the root run with its held line — alone under `--summary`, as 17 does. */
    const HELD_CHECKER = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[args.indexOf('--member') + 1] === '.') {
    const held = 'jterrazz.baseline.json › test: 3 held across 2 rules';
    process.stdout.write(args.includes('--summary') ? held + '\\n' : held + ' — conventions checker (tree)\\n');
}
process.exit(0);
`;

    test("states @jterrazz/test's held line under the Test Conventions pass on a green run", () => {
        // Given - a checker whose root run holds its ratchet
        const project = groundOf();
        writeFileSync(join(project, 'node_modules/@jterrazz/test/dist/checker.js'), HELD_CHECKER);

        // When - the checks run
        const { stdout } = run(project, 'check');
        const conventions = stdout.slice(
            stdout.indexOf('Test Conventions'),
            stdout.indexOf('Suppressions (directives)'),
        );

        // Then - the pass is green and says what the other ratchet section holds, in the one short line
        expect(conventions).toContain('jterrazz.baseline.json › test: 3 held across 2 rules\n');
        expect(conventions).toContain('✓ Passed');
    });

    test("refuses an entry of @jterrazz/test's in this package's section", () => {
        // Given - a typescript section that still carries both packages' keys
        const project = groundOf();
        writeFileSync(
            join(project, 'jterrazz.baseline.json'),
            '{\n  "typescript": { "jterrazz-check/c9": 1, "jterrazz/x1-every-file": 2 }\n}\n',
        );

        // When - the checks run
        const { stdout } = run(project, 'check');

        // Then - each entry is sent to the section that owns it
        expect(stdout).toContain(
            "jterrazz-check/c9 is @jterrazz/test's rule — its entry belongs in jterrazz.baseline.json › test",
        );
        expect(stdout).toContain(
            "jterrazz/x1-every-file is @jterrazz/test's rule — its entry belongs in jterrazz.baseline.json › test",
        );
        expect(verdict(stdout, 'Oxlint Check')).toBe('✗ Failed');
    });
});
