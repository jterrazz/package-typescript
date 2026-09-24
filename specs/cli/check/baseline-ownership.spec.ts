import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

/*
 * A chain in a temp directory, for two reasons. The ground arms a JS plugin
 * named `jterrazz` at `error` — oxlint LOADS every config under this
 * repository, so a committed one would report during this repository's own
 * lint run ([Testing](../../../docs/03-testing.md)). And the checker is a STUB
 * installed as the project's @jterrazz/test, so the pass's verdict is exactly
 * the exit code the stub was told to give.
 *
 * The claim is the ratchet's split: the `typescript` section of
 * `jterrazz.baseline.json` records and judges this package's rules only. A
 * `jterrazz(*)` diagnostic in oxlint's report and a `jterrazz-check(*)`
 * finding are @jterrazz/test's, in its `test` section of the same file —
 * never counted here, never forgiven here, and never rewritten here.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');

let project = '';

/** A plugin that reports once on every file it reads, under the plugin name @jterrazz/test ships. */
const PLUGIN = `export default {
    meta: { name: 'jterrazz' },
    rules: {
        'x1-every-file': {
            create(context) {
                return { Program(node) { context.report({ message: 'reported by the stub plugin', node }); } };
            },
        },
    },
};
`;

/** A checker that prints one finding and exits with the given code. */
function checker(exitCode: number): string {
    return `#!/usr/bin/env node
process.stdout.write('[error] specs/x.spec.ts:1: a finding the stub always reports (C9)\\n');
process.exit(${exitCode});
`;
}

beforeEach(() => {
    project = mkdtempSync(resolve(tmpdir(), 'spec-baseline-ownership-'));
    writeFileSync(
        join(project, 'package.json'),
        `${JSON.stringify({ name: 'spec-baseline-ownership', private: true, type: 'module', version: '1.0.0' }, null, 2)}\n`,
    );
    writeFileSync(
        join(project, 'tsconfig.json'),
        '{ "compilerOptions": { "strict": true, "noEmit": true, "skipLibCheck": true }, "include": ["index.ts"] }\n',
    );
    writeFileSync(join(project, 'plugin.mjs'), PLUGIN);
    writeFileSync(
        join(project, 'oxlint.config.ts'),
        "export default { ignorePatterns: ['node_modules/**', 'plugin.mjs'], jsPlugins: ['./plugin.mjs'], rules: { 'jterrazz/x1-every-file': 'error' } };\n",
    );
    writeFileSync(join(project, 'index.ts'), 'export const value = 1;\n');

    const installed = join(project, 'node_modules/@jterrazz/test');
    mkdirSync(join(installed, 'dist'), { recursive: true });
    writeFileSync(
        join(installed, 'package.json'),
        `${JSON.stringify({ bin: { 'jterrazz-test-check': 'dist/checker.js' }, name: '@jterrazz/test', version: '17.0.0' }, null, 2)}\n`,
    );
    writeFileSync(join(installed, 'dist/checker.js'), checker(0));
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
        writeFileSync(
            join(project, 'index.ts'),
            'export function stop(): void {\n    debugger;\n}\n',
        );

        // When - the baseline is recorded
        run('baseline');

        // Then - the section carries this package's rule and nothing of the plugin's
        const written = readFileSync(join(project, 'jterrazz.baseline.json'), 'utf8');
        expect(JSON.parse(written)).toStrictEqual({ typescript: { 'eslint/no-debugger': 1 } });
    });

    test("leaves @jterrazz/test's section byte for byte", () => {
        // Given - a test section on one line, keys unsorted, beside a stale typescript one and a debugger this package records
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
        run('baseline');

        // Then - only this package's section moved, and the other one's bytes are the ones it wrote
        expect(readFileSync(join(project, 'jterrazz.baseline.json'), 'utf8')).toBe(
            `{\n  "test": ${section},\n  "typescript": {\n    "eslint/no-debugger": 1\n  }\n}\n`,
        );
    });

    test("hands the file it writes to the project's own formatter", () => {
        // Given - a project whose formatter indents by four, and one debugger
        writeFileSync(join(project, '.oxfmtrc.json'), '{ "tabWidth": 4 }\n');
        writeFileSync(
            join(project, 'index.ts'),
            'export function stop(): void {\n    debugger;\n}\n',
        );

        // When - the baseline is recorded
        run('baseline');

        // Then - the file is in the formatter's shape, not the writer's two spaces
        expect(readFileSync(join(project, 'jterrazz.baseline.json'), 'utf8')).toBe(
            '{\n    "typescript": {\n        "eslint/no-debugger": 1\n    }\n}\n',
        );
    });

    test('keeps the oxlint pass green when every diagnostic is a `jterrazz(*)` one', () => {
        // Given - no baseline, and a plugin that fails oxlint on every file
        // When - the checks run
        const { stdout } = run('check');

        // Then - oxlint's exit code is not the verdict: nothing this package owns was reported
        expect(verdict(stdout, 'Oxlint Check')).toBe('✓ Passed');
    });

    test("takes the checker's exit code as the Test Conventions verdict", () => {
        // Given - a checker that fails, and a recorded baseline beside it
        writeFileSync(join(project, 'node_modules/@jterrazz/test/dist/checker.js'), checker(1));
        run('baseline');

        // When - the checks run
        const { stdout } = run('check');

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
        writeFileSync(join(project, 'node_modules/@jterrazz/test/dist/checker.js'), HELD_CHECKER);

        // When - the checks run
        const { stdout } = run('check');
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
        writeFileSync(
            join(project, 'jterrazz.baseline.json'),
            '{\n  "typescript": { "jterrazz-check/c9": 1, "jterrazz/x1-every-file": 2 }\n}\n',
        );

        // When - the checks run
        const { stdout } = run('check');

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
