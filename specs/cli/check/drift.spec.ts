import { directory } from '@jterrazz/test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import manifest from '../../../package.json' with { type: 'json' };
import { onlyPasses } from '../_setup/check-passes.js';
import { temporaryDirectory } from '../_setup/temporary-directory.js';
import { toolchainWith } from '../_setup/toolchain-sandbox.js';
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
        "import { node } from '@jterrazz/typescript/oxlint';\n\nexport default node;\n",
    );
    mkdirSync(join(project, 'node_modules/@jterrazz'), { recursive: true });
    symlinkSync(toolchain, join(project, 'node_modules/@jterrazz/typescript'), 'dir');

    return project;
}

describe('drift', () => {
    test('refuses a rule the profile has on, turned off with no reason beside it', async () => {
        // Given - a project on the node profile that silently turns a rule off, resolving the toolchain this repository installs
        const silent = await driftPass
            .fixture(directory('./_fixtures/drift/project/'))
            .fixture(directory('./_fixtures/drift/off-in-silence/'))
            .link('@jterrazz/typescript')
            .exec('check');

        // Then - the report names the profile, and refuses the rule turned off in silence
        expect(silent.stdout.text).toContain('Deviations from the profile');
        expect(silent.stdout.text).toContain('profile                              node');
        expect(silent.stdout.text).toContain(
            "oxlint.config.ts:1:1: error drift(off-rule-states-its-reason): no-debugger is off and the line that turns it off carries no '// reason:'",
        );
        expect(silent.exitCode).toBe(1);
    });

    test('accepts the same rule turned off, once the line that turns it off says why', async () => {
        // Given - the same rule turned off, with the reason on the line that turns it off
        const reasoned = await driftPass
            .fixture(directory('./_fixtures/drift/project/'))
            .fixture(directory('./_fixtures/drift/off-with-reason/'))
            .link('@jterrazz/typescript')
            .exec('check');

        // Then - the rule is still REPORTED as off, and no longer refused: it is a decision now
        expect(reasoned.stdout.text).toContain(
            'rules off vs profile                 1 (no-debugger)',
        );
        expect(reasoned.stdout.text).not.toContain('drift(off-rule-states-its-reason)');
        expect(reasoned.exitCode).toBe(0);
    });

    test('reads the profile off oxlint.config.mts, one of the names oxlint itself looks for', async () => {
        // Given - the project's config sits at .mts rather than .ts, oxlint's own second candidate
        const result = await driftPass
            .fixture(directory('./_fixtures/drift/project/'))
            .fixture(directory('./_fixtures/drift/config-mts/'))
            .link('@jterrazz/typescript')
            .exec('check');

        // Then - the drift report finds the profile at that name too, not "none of this package's"
        expect(result.stdout.text).toContain('profile                              node');
    });

    test('counts the suppressions, and names a tool left behind its range', () => {
        // Given - a project with one reasoned suppression, on a toolchain whose knip claims 0.0.1
        const toolchain = toolchainWith({ knip: '0.0.1' });
        const project = suppressingProject(toolchain);

        // When - the quality checks run there
        const result = spawnSync('node', [join(toolchain, 'bin/typescript.js'), 'check'], {
            cwd: project,
            encoding: 'utf8',
        });
        const drift = result.stdout.slice(result.stdout.indexOf('Deviations from the profile'));

        // Then - the report counts the directive, and names the one tool that deviates
        expect(drift).toContain('suppressions                         1\n');
        expect(drift).toContain('tool versions                        knip 0.0.1 old\n');
    });

    test('prints the same reading for a machine under check --json', () => {
        // Given - the same project, on the same toolchain
        const toolchain = toolchainWith({ knip: '0.0.1' });
        const project = suppressingProject(toolchain);

        // When - the quality checks run with --json
        const result = spawnSync(
            'node',
            [join(toolchain, 'bin/typescript.js'), 'check', '--json'],
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
            config: 'own',
            floors: {},
            optOuts: [],
            oxlintSuppressions: null,
            profile: 'node',
            rulesOff: [],
            sections: {},
            suppressions: 1,
            tools: [
                {
                    installed: '0.0.1',
                    name: 'knip',
                    range: manifest.dependencies.knip,
                    verdict: 'old',
                },
            ],
            unreasoned: [],
        });
    });
});
