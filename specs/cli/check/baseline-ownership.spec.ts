import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses, SELECTING_BIN } from '../_setup/check-passes.js';
import { temporaryDirectory } from '../_setup/temporary-directory.js';

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
    cpSync(resolve(import.meta.dirname, '_fixtures/baseline/ownership'), project, {
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
    const result = spawnSync('node', [SELECTING_BIN, command], {
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
    test("records every oxlint diagnostic in oxlint's own file, @jterrazz/test's plugin included", () => {
        // Given - a tree whose oxlint diagnostic is the plugin's rule, on every file
        const project = groundOf();

        // When - the baseline is recorded
        run(project, 'baseline');

        // Then - oxlint's file holds both rules, file by file, and the section holds none of them
        const suppressed = JSON.parse(
            readFileSync(join(project, 'oxlint-suppressions.json'), 'utf8'),
        ) as unknown;
        expect(suppressed).toStrictEqual({
            'index.ts': { 'jterrazz/flags-every-file': { count: 1 } },
            'oxlint.config.ts': { 'jterrazz/flags-every-file': { count: 1 } },
        });
        const recorded: unknown = JSON.parse(
            readFileSync(join(project, 'jterrazz.baseline.json'), 'utf8'),
        );
        expect(recorded).toStrictEqual({ typescript: {} });
    });

    test("leaves @jterrazz/test's section byte for byte", () => {
        // Given - a test section on one line, keys unsorted, beside a stale typescript one
        const project = groundOf();
        const section =
            '{ "jterrazz-check/unused-ground": 2, "jterrazz-check/no-unused-ground": 1 }';
        writeFileSync(
            join(project, 'jterrazz.baseline.json'),
            `{\n  "test": ${section},\n  "typescript": { "names/no-grab-bag-name": 4 }\n}\n`,
        );
        writeFileSync(
            join(project, 'index.ts'),
            'export function stop(): void {\n    debugger;\n}\n',
        );

        // When - the baseline is recorded
        run(project, 'baseline');

        // Then - only this package's section moved, and the other one's bytes are the ones it wrote
        expect(readFileSync(join(project, 'jterrazz.baseline.json'), 'utf8')).toBe(
            `{\n    "test": ${section},\n    "typescript": {}\n}\n`,
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

        // Then - both files are in the project's shape, not the writers' two spaces nor the default's four
        expect(readFileSync(join(project, 'jterrazz.baseline.json'), 'utf8')).toBe(
            '{\n\t"typescript": {}\n}\n',
        );
        expect(readFileSync(join(project, 'oxlint-suppressions.json'), 'utf8')).toContain(
            '\t"index.ts": {\n\t\t"jterrazz/flags-every-file": {\n\t\t\t"count": 1\n\t\t}\n\t},',
        );
    });

    test("holds @jterrazz/test's plugin in the oxlint pass, as oxlint's own rule", () => {
        // Given - no recorded debt, and a plugin that fails oxlint on every file
        const project = groundOf();

        // When - the checks run
        const { stdout } = run(project, 'check', { ...process.env, ...onlyPasses('oxlint') });

        // Then - the plugin's diagnostic is oxlint's, printed and judged in its pass
        expect(stdout).toContain('reported by the stub plugin');
        expect(verdict(stdout, 'Oxlint Check')).toBe('✗ Failed');
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

    const FAILING_CHECKER = `#!/usr/bin/env node
process.stdout.write('conventions checker: 1 error(s) found\\n');
process.exit(1);
`;

    // With nothing but PATH and HOME, oxlint picks the framed form, which closes on `Finished in …` even over nothing.
    test('draws nothing under a green oxlint pass when no diagnostic stands behind the broken section', () => {
        // Given - a checker failing, and a config arming no rule, in the framed form's environment
        const project = groundOf();
        writeFileSync(join(project, 'oxlint.config.ts'), 'export default { rules: {} };\n');
        writeFileSync(
            join(project, 'node_modules/@jterrazz/test/dist/checker.js'),
            FAILING_CHECKER,
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
const args = process.argv.slice(2);
if (args[args.indexOf('--member') + 1] === '.') {
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

    test("refuses an oxlint rule left in this package's section, naming the gesture that moves it", () => {
        // Given - a typescript section recorded before oxlint held its own rules
        const project = groundOf();
        writeFileSync(
            join(project, 'jterrazz.baseline.json'),
            '{\n  "typescript": { "eslint/no-debugger": 1, "jterrazz/flags-every-file": 2 }\n}\n',
        );

        // When - the checks run
        const { stdout } = run(project, 'check', { ...process.env, ...onlyPasses('oxlint') });

        // Then - each entry is refused in four parts, sent to oxlint-suppressions.json by `typescript baseline`
        expect(stdout).toContain(
            'baseline-moved-to-oxlint  jterrazz.baseline.json › typescript  found: `eslint/no-debugger` is an oxlint rule',
        );
        expect(stdout).toContain(
            'baseline-moved-to-oxlint  jterrazz.baseline.json › typescript  found: `jterrazz/flags-every-file` is an oxlint rule',
        );
        expect(verdict(stdout, 'Oxlint Check')).toBe('✗ Failed');
    });
});
