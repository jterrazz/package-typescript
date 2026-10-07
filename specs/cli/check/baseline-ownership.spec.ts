import { directory } from '@jterrazz/test';
import type { PrepareStep } from '@jterrazz/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { cli } from '../cli.specification.js';
import { formOnly } from './__setup__/oxlint-forms.js';

// outside: oxlint refuses two plugins by one name in one run, and @jterrazz/test's checks load every config of this
// repository: the fixture cannot hold the stub plugin's config, nor the stub preset, so each case writes them.

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

const FAILING_CHECKER = contribution("'conventions checker: 1 error(s) found'", true);

const HELD_CHECKER = contribution("'.jterrazz/baseline.json › test: 3 held across 2 rules'", false);

const NOTHING_HELD_CHECKER = contribution("'.jterrazz/baseline.json › test: nothing held'", false);

function declared(module: string, { owns = false } = {}): PrepareStep {
    return (workdir) => {
        writeFileSync(join(workdir, 'conventions.mjs'), module);
        const baseline = owns ? "\n            baseline: ['test']," : '';
        writeFileSync(
            join(workdir, 'jterrazz.config.ts'),
            `export default {
    presets: [
        {${baseline}
            checker: {
                label: 'Test Conventions (stub)',
                module: new URL('./conventions.mjs', import.meta.url).pathname,
            },
            name: 'test',
            package: '@jterrazz/test',
        },
    ],
};
`,
        );
    };
}

function written(files: Record<string, string>): PrepareStep {
    return (workdir) => {
        for (const [path, text] of Object.entries(files)) {
            mkdirSync(join(workdir, path, '..'), { recursive: true });
            writeFileSync(join(workdir, path), text);
        }
    };
}

const CONFIG = `export default {
    ignorePatterns: ['node_modules/**', 'plugin.mjs', 'conventions.mjs'],
    jsPlugins: ['./plugin.mjs'],
    rules: { 'jterrazz/flags-every-file': 'error' },
};
`;

const DEBUGGER = 'export function stop(): void {\n    debugger;\n}\n';

function ground(env: Record<string, null | string> = {}) {
    return cli
        .with({ env })
        .fixture(directory('./__fixtures__/baseline/ownership/'))
        .prepare(written({ 'oxlint.config.ts': CONFIG }));
}

describe('baseline-ownership', () => {
    test("records every oxlint diagnostic in oxlint's own file, @jterrazz/test's plugin included", async () => {
        // Given - a tree whose oxlint diagnostic is the plugin's rule, on every file
        // When - the baseline is recorded
        const result = await ground().exec('baseline');

        // Then - oxlint's file holds the rule, file by file, and no section holds any: a ledger at zero is no file
        expect(result.file('.jterrazz/oxlint-suppressions.json').content).toBe(
            '{\n    "index.ts": {\n        "jterrazz/flags-every-file": {\n            "count": 1\n        }\n    },\n    "oxlint.config.ts": {\n        "jterrazz/flags-every-file": {\n            "count": 1\n        }\n    }\n}\n',
        );
        expect(result.file('.jterrazz/baseline.json').exists).toBe(false);
    });

    test("leaves @jterrazz/test's section byte for byte", async () => {
        // Given - a test section on one line, keys unsorted, beside a stale typescript one
        const section =
            '{ "jterrazz-check/unused-ground": 2, "jterrazz-check/no-unused-ground": 1 }';
        // When - the baseline is recorded
        const result = await ground()
            .prepare(
                written({
                    '.jterrazz/baseline.json': `{\n  "test": ${section},\n  "typescript": { "names/no-grab-bag-name": 4 }\n}\n`,
                    'index.ts': DEBUGGER,
                }),
            )
            .exec('baseline');

        // Then - only this package's section moved, gone at zero, and the other one's bytes are the ones it wrote
        expect(result.file('.jterrazz/baseline.json').content).toBe(
            `{\n    "test": ${section}\n}\n`,
        );
    });

    test("hands the file it writes to the project's own formatter", async () => {
        // Given - a project whose formatter indents with tabs, and one debugger
        // When - the baseline is recorded
        const result = await ground()
            .prepare(written({ '.oxfmtrc.json': '{ "useTabs": true }\n', 'index.ts': DEBUGGER }))
            .exec('baseline');

        // Then - the file is in the project's shape, not the writer's two spaces nor the default's four
        expect(result.file('.jterrazz/oxlint-suppressions.json').content).toBe(
            '{\n\t"index.ts": {\n\t\t"jterrazz/flags-every-file": {\n\t\t\t"count": 1\n\t\t}\n\t},\n\t"oxlint.config.ts": {\n\t\t"jterrazz/flags-every-file": {\n\t\t\t"count": 1\n\t\t}\n\t}\n}\n',
        );
    });

    test("holds @jterrazz/test's plugin in the oxlint pass, as oxlint's own rule", async () => {
        // Given - no recorded debt, and a plugin that fails oxlint on every file
        // When - the checks run, oxlint answering in its compact form
        const result = await ground({
            ...formOnly({ AI_AGENT: 'spec' }),
            ...onlyPasses('oxlint'),
        }).exec('check');

        // Then - the plugin's diagnostic is oxlint's, printed and judged in its pass, on each file in the order oxlint's threads finish
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Oxlint Check

            {{any}}
            ✗ Failed with exit code 1

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
        expect(
            result.stdout.text
                .split('\n')
                .filter((line) => line.includes('flags-every-file'))
                .toSorted(),
        ).toStrictEqual([
            'index.ts:1:1: error jterrazz(flags-every-file): reported by the stub plugin',
            'oxlint.config.ts:1:1: error jterrazz(flags-every-file): reported by the stub plugin',
        ]);
    });

    test("takes a preset's checks as its own verdict, under the preset's label", async () => {
        // Given - a declared preset whose checks fail, and a recorded baseline beside it
        // When - the checks run
        const result = await ground(onlyPasses('presets'))
            .prepare(declared(ALWAYS_REPORTS))
            .prepare(
                written({
                    '.jterrazz/oxlint-suppressions.json':
                        '{ "index.ts": { "jterrazz/flags-every-file": { "count": 1 } } }\n',
                }),
            )
            .exec('check');

        // Then - this package's file forgives nothing of the checker's
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Test Conventions (stub)

            [error] specs/x.spec.ts:1: a finding the stub always reports (no-unused-ground)
            ✗ Failed with exit code 1

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });

    // outside: with no form variable set, oxlint picks the framed form, which closes on `Finished in …` even over nothing.
    test('draws nothing under a green oxlint pass when no diagnostic stands behind the broken section', async () => {
        // Given - a checker failing, and a config arming no rule, in the framed form's environment
        // When - the checks run
        const result = await ground({
            ...formOnly({}),
            ...onlyPasses('oxlint', 'oxfmt', 'presets'),
        })
            .prepare(written({ 'oxlint.config.ts': 'export default { rules: {} };\n' }))
            .prepare(declared(FAILING_CHECKER))
            .exec('check');

        // Then - the oxlint pass says only its verdict
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Oxlint Check

            ✓ Passed

             RUN  Oxfmt Check

            ✓ Passed

             RUN  Test Conventions (stub)

            conventions checker: 1 error(s) found
            ✗ Failed with exit code 1

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });

    test("states @jterrazz/test's held line under the Test Conventions pass on a green run", async () => {
        // Given - a checker whose root run holds its ratchet, in a project declaring the preset that owns the section
        // When - the checks run
        const result = await ground(onlyPasses('presets', 'suppressions'))
            .prepare(declared(HELD_CHECKER, { owns: true }))
            .exec('check');

        // Then - the pass is green and says what the other ratchet section holds, in the one short line
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Test Conventions (stub)

            .jterrazz/baseline.json › test: 3 held across 2 rules
            ✓ Passed

             RUN  Suppressions (directives)

            ✓ Passed

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });

    test("states @jterrazz/test's empty section under the Test Conventions pass on a green run", async () => {
        // Given - a checker whose root run holds nothing, in a project declaring the preset that owns the section
        // When - the checks run
        const result = await ground(onlyPasses('presets', 'suppressions'))
            .prepare(declared(NOTHING_HELD_CHECKER, { owns: true }))
            .exec('check');

        // Then - the pass is green and names the section as holding nothing
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Test Conventions (stub)

            .jterrazz/baseline.json › test: nothing held
            ✓ Passed

             RUN  Suppressions (directives)

            ✓ Passed

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });

    test('states no held line for a section no declared preset owns', async () => {
        // Given - the same checks, from a preset that owns no baseline section
        // When - the checks run
        const result = await ground(onlyPasses('presets', 'suppressions'))
            .prepare(declared(HELD_CHECKER))
            .exec('check');

        // Then - the pass is green, and the line is not the toolchain's to repeat
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Test Conventions (stub)

            ✓ Passed

             RUN  Suppressions (directives)

            ✓ Passed

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });

    test("refuses an oxlint rule left in this package's section, naming the gesture that moves it", async () => {
        // Given - a typescript section recorded before oxlint held its own rules
        // When - the checks run, oxlint answering in its compact form
        const result = await ground({ ...formOnly({ AI_AGENT: 'spec' }), ...onlyPasses('oxlint') })
            .prepare(
                written({
                    '.jterrazz/baseline.json':
                        '{\n  "typescript": { "eslint/no-debugger": 1, "jterrazz/flags-every-file": 2 }\n}\n',
                }),
            )
            .exec('check');

        // Then - each entry is refused in four parts, sent to oxlint-suppressions.json by `typescript baseline`
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Oxlint Check

            {{any}}
            baseline-moved-to-oxlint  .jterrazz/baseline.json › typescript  found: \`eslint/no-debugger\` is an oxlint rule, and the section holds its count · why: oxlint holds its own rules in .jterrazz/oxlint-suppressions.json, file by file, so the section holds only the passes of this toolchain · fix: run 'typescript baseline', which records the lint debt in .jterrazz/oxlint-suppressions.json and drops the entry · read: docs/reference/quality-checks.md#the-ratchet
            baseline-moved-to-oxlint  .jterrazz/baseline.json › typescript  found: \`jterrazz/flags-every-file\` is an oxlint rule, and the section holds its count · why: oxlint holds its own rules in .jterrazz/oxlint-suppressions.json, file by file, so the section holds only the passes of this toolchain · fix: run 'typescript baseline', which records the lint debt in .jterrazz/oxlint-suppressions.json and drops the entry · read: docs/reference/quality-checks.md#the-ratchet
            ✗ Failed with exit code 1

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });
});
