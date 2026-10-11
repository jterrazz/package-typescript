import { directory } from '@jterrazz/test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import manifest from '../../../package.json' with { type: 'json' };
import { temporaryDirectory } from '../../__setup__/temporary-directory.js';
import { onlyPasses } from '../__setup__/check-passes.js';
import { toolchainWith } from '../__setup__/toolchain-sandbox.js';
import { cli } from '../cli.specification.js';

const driftPass = cli.with({ env: onlyPasses('drift') });

function suppressingProject(toolchain: string): string {
    const project = temporaryDirectory('spec-drift-rows-');
    writeFileSync(
        join(project, 'package.json'),
        '{ "name": "spec-drift-rows", "private": true, "type": "module" }\n',
    );
    writeFileSync(
        join(project, 'tsconfig.json'),
        '{ "compilerOptions": { "strict": true, "noEmit": true }, "include": ["**/*.ts"] }\n',
    );
    writeFileSync(
        join(project, 'index.ts'),
        'export function stop(): void {\n    // oxlint-disable-next-line no-debugger -- the pause is the point\n    debugger;\n}\n',
    );
    writeFileSync(
        join(project, 'oxlint.config.ts'),
        "import { oxlintConfig } from '@jterrazz/typescript/oxlint';\n\nexport default await oxlintConfig(import.meta.url);\n",
    );
    mkdirSync(join(project, 'node_modules/@jterrazz'), { recursive: true });
    symlinkSync(toolchain, join(project, 'node_modules/@jterrazz/typescript'), 'dir');

    return project;
}

describe('drift', () => {
    test('reports a rule the settings set apart from the profile, which the settings say why of', async () => {
        // Given - a project whose jterrazz.config.ts turns a rule of its profile off, with its reason
        const reasoned = await driftPass
            .fixture(directory('./__fixtures__/drift/project/'))
            .fixture(directory('./__fixtures__/drift/off-with-reason/'))
            .link('@jterrazz/typescript')
            .exec('check');

        // Then - the report names the declaration and the rule turned off
        expect(reasoned.stdout.text).toContain(
            'declared                              api on node\n  exceptions                            1\n  rules off vs profile                  1 (no-debugger)\n',
        );
        expect(reasoned.exitCode).toBe(0);
    });

    test('refuses a rule set apart with no reason, before any tool reads it', async () => {
        // Given - the same rule turned off, with no reason
        const silent = await cli
            .with({ env: onlyPasses('oxlint') })
            .fixture(directory('./__fixtures__/drift/project/'))
            .fixture(directory('./__fixtures__/drift/off-without-reason/'))
            .link('@jterrazz/typescript')
            .exec('check');

        // Then - the linter refuses the settings, naming the rule and what it owes
        expect(silent.stdout.text).toContain(
            'sets `no-debugger` with no `{ level, reason }` — a rule the project sets apart from its profile says why',
        );
        expect(silent.exitCode).toBe(1);
    });

    test('counts the suppressions, and names a tool left behind its range', () => {
        // Given - a project with one reasoned suppression, on a toolchain whose knip claims 0.0.1
        const toolchain = toolchainWith({ knip: '0.0.1' });
        const project = suppressingProject(toolchain);

        // When - the quality checks run there
        const result = spawnSync('node', [join(toolchain, 'dist/typescript.js'), 'check'], {
            cwd: project,
            encoding: 'utf8',
        });
        const drift = result.stdout.slice(result.stdout.indexOf('Deviations from the profile'));

        // Then - the report counts the directive, and names the one tool that deviates
        expect(drift).toContain('suppressions                          1\n');
        expect(drift).toContain('tool versions                         knip 0.0.1 old\n');
    });

    test('counts the browser-side mutants the last run left unclaimed, in the report and for a machine', () => {
        // Given - a project whose last module report holds two unclaimed mutants of an island, one of a server source, and one detected island mutant
        const toolchain = toolchainWith({});
        const project = suppressingProject(toolchain);
        mkdirSync(join(project, '.artifacts/stryker'), { recursive: true });
        const mutant = (status: string): object => ({ status });
        writeFileSync(
            join(project, '.artifacts/stryker/report.json'),
            JSON.stringify({
                files: {
                    'src/island.tsx': {
                        mutants: [mutant('NoCoverage'), mutant('NoCoverage'), mutant('Killed')],
                    },
                    'src/server.ts': { mutants: [mutant('NoCoverage')] },
                },
            }),
        );

        // When - the quality checks run there, then again for a machine
        const run = (...flags: string[]): string =>
            spawnSync('node', [join(toolchain, 'dist/typescript.js'), 'check', ...flags], {
                cwd: project,
                encoding: 'utf8',
            }).stdout;
        const human = run();
        const machine = run('--json');

        // Then - the row counts the two island mutants, never the server one, and the JSON carries the same number
        expect(human).toContain('unmeasured                            2 mutants (browser-side)\n');
        expect(machine).toContain('"unmeasuredMutants": 2');
    });

    test('prints the same reading for a machine under check --json', () => {
        // Given - the same project, on the same toolchain
        const toolchain = toolchainWith({ knip: '0.0.1' });
        const project = suppressingProject(toolchain);

        // When - the quality checks run with --json
        const result = spawnSync(
            'node',
            [join(toolchain, 'dist/typescript.js'), 'check', '--json'],
            {
                cwd: project,
                encoding: 'utf8',
            },
        );
        const start = result.stdout.indexOf('Deviations from the profile');
        const drift = result.stdout.slice(start, result.stdout.indexOf(' END ', start));
        const reading = drift.slice(drift.indexOf('{'), drift.lastIndexOf('}') + 1);

        // Then - the drift block is one JSON object carrying every row the human block prints
        expect(JSON.parse(reading)).toStrictEqual({
            baseline: null,
            declaration: null,
            exceptions: 0,
            members: {},
            mutationDirectives: 0,
            optOuts: [],
            oxlintSuppressions: null,
            rulesOff: [],
            sections: {},
            suppressions: 1,
            unmeasuredByMember: {},
            unmeasuredMutants: 0,
            tools: [
                {
                    installed: '0.0.1',
                    name: 'knip',
                    range: manifest.dependencies.knip,
                    verdict: 'old',
                },
            ],
        });
    });
});
