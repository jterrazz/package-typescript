import { directory } from '@jterrazz/test';
import type { PrepareStep } from '@jterrazz/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { cli } from '../cli.specification.js';

// invariant: the stubs fail unless a case asks otherwise: a passing pass prints nothing, which would leave the claim unmade.

// outside: a stub plugin registers the `jterrazz` name, which this repository's own config holds: oxlint loads every config under the repository, so the armed config is written where the spec runs, never committed.

function contribution(name: string, exit: 0 | 1): string {
    return `export default {
    passes: {
        async conventions() {
            return {
                valued: ['--member'],
                check(context) {
                    const member = context.value('--member');
                    const said = member === undefined ? '${name} repository pass' : \`${name} member pass: \${member}\`;

                    return { failed: ${String(exit === 1)}, lines: [said] };
                },
            };
        },
    },
};
`;
}

function declare(dir: string, name: string, exit: 0 | 1 = 1): void {
    writeFileSync(join(dir, 'conventions.mjs'), contribution(name, exit));
    writeFileSync(
        join(dir, 'jterrazz.config.ts'),
        `export default {
    presets: [
        {
            baseline: ['stub'],
            checker: { label: 'Stub Conventions', module: new URL('./conventions.mjs', import.meta.url).pathname },
            name: 'stub',
            package: 'stub',
        },
    ],
};
`,
    );
}

const PLUGIN = `export default {
    meta: { name: 'jterrazz' },
    rules: {
        'flags-once': {
            create(context) {
                return {
                    Program(node) {
                        if (context.filename.endsWith('apps/web/src/index.ts')) {
                            context.report({ message: 'reported by the stub plugin', node });
                        }
                    },
                };
            },
        },
    },
};
`;

function armPlugin(dir: string): void {
    writeFileSync(join(dir, 'plugin.mjs'), PLUGIN);
    writeFileSync(
        join(dir, 'oxlint.config.ts'),
        "export default { ignorePatterns: ['plugin.mjs', 'conventions.mjs'], jsPlugins: ['./plugin.mjs'], rules: { 'jterrazz/flags-once': 'error' } };\n",
    );
}

const WRITING = `export default {
    commands: {
        async baseline() {
            return () => {
                process.stdout.write('the stub recorded its section\\n');

                return 0;
            };
        },
    },
    passes: {
        async conventions() {
            return {
                valued: ['--member'],
                check(context) {
                    return context.fix
                        ? { writes: [{ path: 'written.ts', text: 'export const  written =1\\n' }] }
                        : {};
                },
            };
        },
    },
};
`;

// invariant: `conventions` replaces the stub preset's checks.
function declared(options: { conventions?: string; exit?: 0 | 1 } = {}): PrepareStep {
    return (workdir) => {
        declare(workdir, 'root', options.exit ?? 1);
        if (options.conventions !== undefined) {
            writeFileSync(join(workdir, 'conventions.mjs'), options.conventions);
        }
    };
}

function passes(selected: string) {
    return cli
        .with({ env: { TYPESCRIPT_CHECK_PASSES: selected } })
        .fixture(directory('./__fixtures__/presets-member/'));
}

describe('presets-member', () => {
    test("fixes with a preset's checks first, so the formatter formats what they wrote", async () => {
        // Given - a preset whose fixing run writes an unformatted module
        // When - the fixes run
        const result = await passes('presets,oxfmt')
            .prepare(declared({ conventions: WRITING }))
            .exec('fix');

        // Then - the module the preset wrote stands in the formatter's shape
        expect(result.file('written.ts').content).toBe('export const written = 1;\n');
    });

    test("records a preset's own section when the baseline is recorded", async () => {
        // Given - a preset holding a section of debt, whose checks name a baseline command
        // When - the baseline is recorded
        const result = await passes('presets')
            .prepare(declared({ conventions: WRITING }))
            .exec('baseline');

        // Then - the preset recorded its own section
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Recording the baseline...

            .jterrazz/baseline.json › typescript written — 0 finding(s) across 0 rule(s)
            the stub recorded its section
        `);
    });

    test("runs a declared preset's checks once, over the whole repository", async () => {
        // Given - a workspace whose only declaration is the root's, one member with specs and one without
        // When - the quality checks run at the root
        const result = await passes('presets').prepare(declared()).exec('check');

        // Then - the preset is asked once, under its own label, and walks the members itself
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Stub Conventions

            root repository pass
            ✗ Failed with exit code 1

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });

    test("passes a preset's run whose checks pass, and runs no linter for it", async () => {
        // Given - a workspace whose preset passes, and whose armed plugin would fail the linter
        // When - the presets pass alone runs at the root
        const result = await passes('presets')
            .prepare(declared({ exit: 0 }))
            .prepare(armPlugin)
            .exec('check');

        // Then - the preset's checks are their own verdict: the linter neither runs nor weighs
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Stub Conventions

            ✓ Passed

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });

    test('runs the checks a member declares on that member, beside the repository run', async () => {
        // Given - a member declaring its own preset beside the root's
        // When - the quality checks run at the root
        const result = await passes('presets')
            .prepare(declared())
            .prepare((workdir) => {
                declare(join(workdir, 'apps/api'), 'nested');
            })
            .exec('check');

        // Then - the member is judged by its own declaration, the repository by the root's
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Stub Conventions

            root repository pass
            nested member pass: apps/api
            ✗ Failed with exit code 1

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });

    test('never judges a project by what the tree around it declares', async () => {
        // Given - a repository checked out inside another tree that declares a preset
        // When - the quality checks run inside it
        const result = await cli
            .with({ env: onlyPasses('presets') })
            .prepare((workdir) => {
                declare(workdir, 'outer');
                const project = join(workdir, 'project');
                mkdirSync(join(project, 'specs'), { recursive: true });
                writeFileSync(join(project, '.git'), 'gitdir: /nowhere\n');
                writeFileSync(
                    join(project, 'package.json'),
                    `${JSON.stringify({ name: 'spec-presets-boundary', private: true }, null, 2)}\n`,
                );
                writeFileSync(join(project, 'specs/index.test.ts'), 'export const value = 1;\n');
            })
            .exec('check', { cwd: 'project' });

        // Then - the pass does not exist: the declaration above the boundary is another project's
        expect(result.stdout).toMatch(`
             START  Running quality checks

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });
});
