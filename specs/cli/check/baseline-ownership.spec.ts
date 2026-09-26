import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses, SELECTING_BIN } from '../check-passes.js';
import { temporaryDirectory } from '../temporary-directory.js';

// The stub checker lives under `node_modules/`, which git never tracks. oxlint refuses two plugins by one
// name in one run, and @jterrazz/test's checker loads every config of this repository: the fixture cannot hold these.

function checker(exitCode: number): string {
    return `#!/usr/bin/env node
process.stdout.write('[error] specs/x.spec.ts:1: a finding the stub always reports (no-unused-ground)\\n');
process.exit(${exitCode});
`;
}

const CONFIG = `export default {
    ignorePatterns: ['node_modules/**', 'plugin.mjs'],
    jsPlugins: ['./plugin.mjs'],
    rules: { 'jterrazz/flags-every-file': 'error' },
};
`;

function groundOf(): string {
    const project = temporaryDirectory('spec-baseline-ownership-');
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

// npm sets `INIT_CWD` for whatever script started this suite, and `baseline` records into it.
function run(
    project: string,
    command: string,
    env: NodeJS.ProcessEnv = process.env,
): { status: null | number; stdout: string } {
    const result = spawnSync('bash', [SELECTING_BIN, command], {
        cwd: project,
        encoding: 'utf8',
        env: { ...env, INIT_CWD: project },
    });

    return { status: result.status, stdout: result.stdout };
}

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
        const section = '{ "jterrazz/flags-every-file": 2, "jterrazz-check/no-unused-ground": 1 }';
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
        const { stdout } = run(project, 'check', { ...process.env, ...onlyPasses('oxlint') });

        // Then - oxlint's exit code is not the verdict: nothing this package owns was reported
        expect(verdict(stdout, 'Oxlint Check')).toBe('✓ Passed');
    });

    test("takes the checker's exit code as the Test Conventions verdict", () => {
        // Given - a checker that fails, and a recorded baseline beside it
        const project = groundOf();
        writeFileSync(join(project, 'node_modules/@jterrazz/test/dist/checker.js'), checker(1));
        run(project, 'baseline');

        // When - the checks run
        const { stdout } = run(project, 'check', { ...process.env, ...onlyPasses('conventions') });

        // Then - this package's file forgives nothing of the checker's
        expect(verdict(stdout, 'Test Conventions')).toBe('✗ Failed');
        expect(stdout).toContain('a finding the stub always reports');
    });

    const COUNTING_CHECKER = `#!/usr/bin/env node
process.stdout.write("conventions checker: 1 plugin diagnostic judged, printed by oxlint's own pass\\n");
process.exit(1);
`;

    test("prints a `jterrazz(*)` diagnostic's location once when only @jterrazz/test's section breaks", () => {
        // Given - a checker failing on the plugin's rule alone, and nothing this package owns reported
        const project = groundOf();
        writeFileSync(
            join(project, 'node_modules/@jterrazz/test/dist/checker.js'),
            COUNTING_CHECKER,
        );

        // When - the checks run
        const { stdout } = run(project, 'check', {
            ...process.env,
            ...onlyPasses('oxlint', 'oxfmt', 'conventions'),
        });
        const oxlint = stdout.slice(stdout.indexOf('Oxlint Check'), stdout.indexOf('Oxfmt Check'));

        // Then - the oxlint pass keeps its own verdict and prints the diagnostic, where it stands
        expect(verdict(stdout, 'Oxlint Check')).toBe('✓ Passed');
        expect(oxlint).toContain('index.ts');

        // Then - each of its two diagnostics, the config's and index.ts's, once across the whole run
        expect(oxlint.split('reported by the stub plugin')).toHaveLength(3);
        expect(stdout.split('reported by the stub plugin')).toHaveLength(3);
        expect(verdict(stdout, 'Test Conventions')).toBe('✗ Failed');
    });

    // With nothing but PATH and HOME, oxlint picks the framed form, which closes on `Finished in …` even over nothing.
    test('draws nothing under a green oxlint pass when no diagnostic stands behind the broken section', () => {
        // Given - a checker failing, and a config arming no rule, in the framed form's environment
        const project = groundOf();
        writeFileSync(join(project, 'oxlint.config.ts'), 'export default { rules: {} };\n');
        writeFileSync(
            join(project, 'node_modules/@jterrazz/test/dist/checker.js'),
            COUNTING_CHECKER,
        );

        // When - the checks run
        const { stdout } = run(project, 'check', {
            HOME: process.env.HOME,
            PATH: process.env.PATH,
            ...onlyPasses('oxlint', 'oxfmt', 'conventions'),
        });
        const oxlint = stdout.slice(stdout.indexOf('Oxlint Check'), stdout.indexOf('Oxfmt Check'));

        // Then - the pass says only its verdict
        expect(oxlint).not.toContain('Finished in');
        expect(verdict(stdout, 'Oxlint Check')).toBe('✓ Passed');
    });

    const HELD_CHECKER = `#!/usr/bin/env node
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const args = process.argv.slice(2);
if (args[args.indexOf('--member') + 1] === '.') {
    writeFileSync(join(__dirname, 'root-argv.json'), JSON.stringify(args));
    process.stdout.write('jterrazz.baseline.json › test: 3 held across 2 rules\\n');
}
process.exit(0);
`;

    test("states @jterrazz/test's held line under the Test Conventions pass on a green run", () => {
        // Given - a checker whose root run holds its ratchet
        const project = groundOf();
        writeFileSync(join(project, 'node_modules/@jterrazz/test/dist/checker.js'), HELD_CHECKER);

        // When - the checks run
        const { stdout } = run(project, 'check', {
            ...process.env,
            ...onlyPasses('conventions', 'suppressions'),
        });
        const conventions = stdout.slice(
            stdout.indexOf('Test Conventions'),
            stdout.indexOf('Suppressions (directives)'),
        );

        // Then - the pass is green and says what the other ratchet section holds, in the one short line
        expect(conventions).toContain('jterrazz.baseline.json › test: 3 held across 2 rules\n');
        expect(conventions).toContain('✓ Passed');
    });

    test('asks the root run for no flag @jterrazz/test 17 dropped', () => {
        // Given - a checker recording the argv of its root run
        const project = groundOf();
        writeFileSync(join(project, 'node_modules/@jterrazz/test/dist/checker.js'), HELD_CHECKER);

        // When - the checks run
        run(project, 'check', { ...process.env, ...onlyPasses('conventions') });
        const argv = readFileSync(
            join(project, 'node_modules/@jterrazz/test/dist/root-argv.json'),
            'utf8',
        );

        // Then - the root run is the member run over `.`, and carries no `--summary`
        expect(JSON.parse(argv)).toContain('--member');
        expect(JSON.parse(argv)).not.toContain('--summary');
    });

    const NOTHING_HELD_CHECKER = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[args.indexOf('--member') + 1] === '.') {
    process.stdout.write('jterrazz.baseline.json › test: nothing held\\n');
}
process.exit(0);
`;

    test("states @jterrazz/test's empty section under the Test Conventions pass on a green run", () => {
        // Given - a checker whose root run holds nothing
        const project = groundOf();
        writeFileSync(
            join(project, 'node_modules/@jterrazz/test/dist/checker.js'),
            NOTHING_HELD_CHECKER,
        );

        // When - the checks run
        const { stdout } = run(project, 'check', {
            ...process.env,
            ...onlyPasses('conventions', 'suppressions'),
        });
        const conventions = stdout.slice(
            stdout.indexOf('Test Conventions'),
            stdout.indexOf('Suppressions (directives)'),
        );

        // Then - the pass is green and names the section as holding nothing
        expect(conventions).toContain('jterrazz.baseline.json › test: nothing held\n');
        expect(conventions).toContain('✓ Passed');
    });

    test("refuses an entry of @jterrazz/test's in this package's section", () => {
        // Given - a typescript section that still carries both packages' keys
        const project = groundOf();
        writeFileSync(
            join(project, 'jterrazz.baseline.json'),
            '{\n  "typescript": { "jterrazz-check/no-unused-ground": 1, "jterrazz/flags-every-file": 2 }\n}\n',
        );

        // When - the checks run
        const { stdout } = run(project, 'check', { ...process.env, ...onlyPasses('oxlint') });

        // Then - each entry is sent to the section that owns it
        expect(stdout).toContain(
            "jterrazz-check/no-unused-ground is @jterrazz/test's rule — its entry belongs in jterrazz.baseline.json › test",
        );
        expect(stdout).toContain(
            "jterrazz/flags-every-file is @jterrazz/test's rule — its entry belongs in jterrazz.baseline.json › test",
        );
        expect(verdict(stdout, 'Oxlint Check')).toBe('✗ Failed');
    });
});
