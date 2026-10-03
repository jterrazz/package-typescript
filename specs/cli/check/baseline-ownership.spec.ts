import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses, SELECTING_BIN } from '../_setup/check-passes.js';
import { temporaryDirectory } from '../_setup/temporary-directory.js';

// oxlint refuses two plugins by one name in one run, and @jterrazz/test's checks load every config of this
// repository: the fixture cannot hold the stub preset, so each case writes it.

function contribution(lines: string, failed: boolean): string {
    return `export default {
    passes: {
        async conventions() {
            return {
                check() {
                    return { failed: ${String(failed)}, lines: [${lines}] };
                },
            };
        },
    },
};
`;
}

const ALWAYS_REPORTS = contribution(
    "'[error] specs/x.spec.ts:1: a finding the stub always reports (no-unused-ground)'",
    true,
);

function declared(project: string, module: string, { owns = false } = {}): void {
    writeFileSync(join(project, 'conventions.mjs'), module);
    const baseline = owns ? "baseline: ['test'], " : '';
    writeFileSync(
        join(project, 'jterrazz.config.ts'),
        `export default { presets: [{ ${baseline}checker: { label: 'Test Conventions (stub)', module: new URL('./conventions.mjs', import.meta.url).pathname }, name: 'test', package: '@jterrazz/test' }] };\n`,
    );
}

const CONFIG = `export default {
    ignorePatterns: ['node_modules/**', 'plugin.mjs', 'conventions.mjs'],
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

        // Then - oxlint's file holds both rules, file by file, and no section holds any: a ledger at zero is no file
        const suppressed = JSON.parse(
            readFileSync(join(project, '.jterrazz/oxlint-suppressions.json'), 'utf8'),
        ) as unknown;
        expect(suppressed).toStrictEqual({
            'index.ts': { 'jterrazz/flags-every-file': { count: 1 } },
            'oxlint.config.ts': { 'jterrazz/flags-every-file': { count: 1 } },
        });
        expect(existsSync(join(project, '.jterrazz/baseline.json'))).toBe(false);
    });

    test("leaves @jterrazz/test's section byte for byte", () => {
        // Given - a test section on one line, keys unsorted, beside a stale typescript one
        const project = groundOf();
        const section =
            '{ "jterrazz-check/unused-ground": 2, "jterrazz-check/no-unused-ground": 1 }';
        mkdirSync(join(project, '.jterrazz'), { recursive: true });
        writeFileSync(
            join(project, '.jterrazz/baseline.json'),
            `{\n  "test": ${section},\n  "typescript": { "names/no-grab-bag-name": 4 }\n}\n`,
        );
        writeFileSync(
            join(project, 'index.ts'),
            'export function stop(): void {\n    debugger;\n}\n',
        );

        // When - the baseline is recorded
        run(project, 'baseline');

        // Then - only this package's section moved, gone at zero, and the other one's bytes are the ones it wrote
        expect(readFileSync(join(project, '.jterrazz/baseline.json'), 'utf8')).toBe(
            `{\n    "test": ${section}\n}\n`,
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
        expect(readFileSync(join(project, '.jterrazz/oxlint-suppressions.json'), 'utf8')).toContain(
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

    test("takes a preset's checks as its own verdict, under the preset's label", () => {
        // Given - a declared preset whose checks fail, and a recorded baseline beside it
        const project = groundOf();
        declared(project, ALWAYS_REPORTS);
        run(project, 'baseline');

        // When - the checks run
        const { stdout } = run(project, 'check', { ...process.env, ...onlyPasses('presets') });

        // Then - this package's file forgives nothing of the checker's
        expect(verdict(stdout, 'Test Conventions')).toBe('✗ Failed');
        expect(stdout).toContain('a finding the stub always reports');
    });

    const FAILING_CHECKER = contribution("'conventions checker: 1 error(s) found'", true);

    // With nothing but PATH and HOME, oxlint picks the framed form, which closes on `Finished in …` even over nothing.
    test('draws nothing under a green oxlint pass when no diagnostic stands behind the broken section', () => {
        // Given - a checker failing, and a config arming no rule, in the framed form's environment
        const project = groundOf();
        writeFileSync(join(project, 'oxlint.config.ts'), 'export default { rules: {} };\n');
        declared(project, FAILING_CHECKER);

        // When - the checks run
        const { stdout } = run(project, 'check', {
            HOME: process.env.HOME,
            PATH: process.env.PATH,
            ...onlyPasses('oxlint', 'oxfmt', 'presets'),
        });
        const oxlint = stdout.slice(stdout.indexOf('Oxlint Check'), stdout.indexOf('Oxfmt Check'));

        // Then - the pass says only its verdict
        expect(oxlint).not.toContain('Finished in');
        expect(verdict(stdout, 'Oxlint Check')).toBe('✓ Passed');
    });

    const HELD_CHECKER = contribution(
        "'.jterrazz/baseline.json › test: 3 held across 2 rules'",
        false,
    );

    test("states @jterrazz/test's held line under the Test Conventions pass on a green run", () => {
        // Given - a checker whose root run holds its ratchet, in a project declaring the preset that owns the section
        const project = groundOf();
        declared(project, HELD_CHECKER, { owns: true });

        // When - the checks run
        const { stdout } = run(project, 'check', {
            ...process.env,
            ...onlyPasses('presets', 'suppressions'),
        });
        const conventions = stdout.slice(
            stdout.indexOf('Test Conventions'),
            stdout.indexOf('Suppressions (directives)'),
        );

        // Then - the pass is green and says what the other ratchet section holds, in the one short line
        expect(conventions).toContain('.jterrazz/baseline.json › test: 3 held across 2 rules\n');
        expect(conventions).toContain('✓ Passed');
    });

    const NOTHING_HELD_CHECKER = contribution(
        "'.jterrazz/baseline.json › test: nothing held'",
        false,
    );

    test("states @jterrazz/test's empty section under the Test Conventions pass on a green run", () => {
        // Given - a checker whose root run holds nothing, in a project declaring the preset that owns the section
        const project = groundOf();
        declared(project, NOTHING_HELD_CHECKER, { owns: true });

        // When - the checks run
        const { stdout } = run(project, 'check', {
            ...process.env,
            ...onlyPasses('presets', 'suppressions'),
        });
        const conventions = stdout.slice(
            stdout.indexOf('Test Conventions'),
            stdout.indexOf('Suppressions (directives)'),
        );

        // Then - the pass is green and names the section as holding nothing
        expect(conventions).toContain('.jterrazz/baseline.json › test: nothing held\n');
        expect(conventions).toContain('✓ Passed');
    });

    test('states no held line for a section no declared preset owns', () => {
        // Given - the same checks, from a preset that owns no baseline section
        const project = groundOf();
        declared(project, HELD_CHECKER);

        // When - the checks run
        const { stdout } = run(project, 'check', {
            ...process.env,
            ...onlyPasses('presets', 'suppressions'),
        });

        // Then - the pass is green, and the line is not the toolchain's to repeat
        expect(stdout).not.toContain('.jterrazz/baseline.json › test:');
        expect(verdict(stdout, 'Test Conventions')).toBe('✓ Passed');
    });

    test("refuses an oxlint rule left in this package's section, naming the gesture that moves it", () => {
        // Given - a typescript section recorded before oxlint held its own rules
        const project = groundOf();
        mkdirSync(join(project, '.jterrazz'), { recursive: true });
        writeFileSync(
            join(project, '.jterrazz/baseline.json'),
            '{\n  "typescript": { "eslint/no-debugger": 1, "jterrazz/flags-every-file": 2 }\n}\n',
        );

        // When - the checks run
        const { stdout } = run(project, 'check', { ...process.env, ...onlyPasses('oxlint') });

        // Then - each entry is refused in four parts, sent to oxlint-suppressions.json by `typescript baseline`
        expect(stdout).toContain(
            'baseline-moved-to-oxlint  .jterrazz/baseline.json › typescript  found: `eslint/no-debugger` is an oxlint rule',
        );
        expect(stdout).toContain(
            'baseline-moved-to-oxlint  .jterrazz/baseline.json › typescript  found: `jterrazz/flags-every-file` is an oxlint rule',
        );
        expect(verdict(stdout, 'Oxlint Check')).toBe('✗ Failed');
    });
});
