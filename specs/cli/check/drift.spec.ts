import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import manifest from '../../../package.json' with { type: 'json' };
import { newDirectory, temporaryDirectory } from '../_setup/temporary-directory.js';
import { toolchainWith } from '../_setup/toolchain-sandbox.js';

// A config naming `@jterrazz/typescript/oxlint` must resolve it, and the spec runner copies rather than
// installs: the project is built with the link npm would have made.

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.js');
const PACKAGE_ROOT = resolve(import.meta.dirname, '../../..');

const project = newDirectory('spec-drift-');

afterAll(() => {
    rmSync(project, { force: true, recursive: true });
});

function stand(config: string, configName = 'oxlint.config.ts'): void {
    writeFileSync(
        join(project, 'package.json'),
        `${JSON.stringify(
            { name: 'spec-drift', private: true, type: 'module', version: '1.0.0' },
            null,
            2,
        )}\n`,
    );
    writeFileSync(
        join(project, 'tsconfig.json'),
        '{ "compilerOptions": { "strict": true, "noEmit": true }, "include": ["**/*.ts"] }\n',
    );
    writeFileSync(join(project, 'index.ts'), 'export const title = "spec";\n');
    mkdirSync(join(project, 'node_modules/@jterrazz'), { recursive: true });
    try {
        symlinkSync(PACKAGE_ROOT, join(project, 'node_modules/@jterrazz/typescript'), 'dir');
    } catch {
        /* Already linked by an earlier case of this chain. */
    }
    for (const name of ['oxlint.config.ts', 'oxlint.config.mts']) {
        if (name !== configName) {
            rmSync(join(project, name), { force: true });
        }
    }
    writeFileSync(join(project, configName), config);
}

function suppressingProject(toolchain: string): string {
    const directory = temporaryDirectory('spec-drift-rows-');
    writeFileSync(
        join(directory, 'package.json'),
        '{ "name": "spec-drift-rows", "private": true, "type": "module" }\n',
    );
    writeFileSync(
        join(directory, 'tsconfig.json'),
        '{ "compilerOptions": { "strict": true, "noEmit": true }, "include": ["**/*.ts"] }\n',
    );
    writeFileSync(
        join(directory, 'index.ts'),
        'export function stop(): void {\n    // oxlint-disable-next-line no-debugger -- the pause is the point\n    debugger;\n}\n',
    );
    writeFileSync(
        join(directory, 'oxlint.config.ts'),
        "import { node } from '@jterrazz/typescript/oxlint';\n\nexport default node;\n",
    );
    mkdirSync(join(directory, 'node_modules/@jterrazz'), { recursive: true });
    symlinkSync(toolchain, join(directory, 'node_modules/@jterrazz/typescript'), 'dir');

    return directory;
}

describe('drift', () => {
    test('refuses a rule the profile has on, turned off with no reason beside it', () => {
        // Given - a project on the node profile that silently turns a rule off
        stand(
            [
                "import { compose, node } from '@jterrazz/typescript/oxlint';",
                '',
                'export default compose(node, {',
                '    rules: {',
                "        'no-debugger': 'off',",
                '    },',
                '});',
                '',
            ].join('\n'),
        );

        // When - the quality checks run there
        const silent = spawnSync('node', [BIN, 'check'], { cwd: project, encoding: 'utf8' });

        // Then - the report names the profile, and refuses the rule turned off in silence
        expect(silent.stdout).toContain('Deviations from the profile');
        expect(silent.stdout).toContain('profile                              node');
        expect(silent.stdout).toContain(
            "oxlint.config.ts:1:1: error drift(off-rule-states-its-reason): no-debugger is off and the line that turns it off carries no '// reason:'",
        );
        expect(silent.status).toBe(1);
    });

    test('accepts the same rule turned off, once the line that turns it off says why', () => {
        // Given - the same rule turned off, with the reason on the line that turns it off
        stand(
            [
                "import { compose, node } from '@jterrazz/typescript/oxlint';",
                '',
                'export default compose(node, {',
                '    rules: {',
                "        'no-debugger': 'off', // reason: the debugger IS the product here",
                '    },',
                '});',
                '',
            ].join('\n'),
        );

        // When - the quality checks run again
        const reasoned = spawnSync('node', [BIN, 'check'], { cwd: project, encoding: 'utf8' });

        // A sandbox linking this checkout into its node_modules lints this repository, so the exit code is not the claim.

        // Then - the rule is still REPORTED as off, and no longer refused: it is a decision now
        expect(reasoned.stdout).toContain('rules off vs profile                 1 (no-debugger)');
        expect(reasoned.stdout).not.toContain('drift/off-rule-states-its-reason');
    });

    test('reads the profile off oxlint.config.mts, one of the names oxlint itself looks for', () => {
        // Given - the project's config sits at .mts rather than .ts, oxlint's own second candidate
        stand(
            [
                "import { node } from '@jterrazz/typescript/oxlint';",
                '',
                'export default node;',
                '',
            ].join('\n'),
            'oxlint.config.mts',
        );

        // When - the quality checks run there
        const result = spawnSync('node', [BIN, 'check'], { cwd: project, encoding: 'utf8' });

        // Then - the drift report finds the profile at that name too, not "none of this package's"
        expect(result.stdout).toContain('profile                              node');
    });

    test('counts the suppressions, and names a tool left behind its range', () => {
        // Given - a project with one reasoned suppression, on a toolchain whose knip claims 0.0.1
        const toolchain = toolchainWith({ knip: '0.0.1' });
        const directory = suppressingProject(toolchain);

        // When - the quality checks run there
        const result = spawnSync('node', [join(toolchain, 'bin/typescript.js'), 'check'], {
            cwd: directory,
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
        const directory = suppressingProject(toolchain);

        // When - the quality checks run with --json
        const result = spawnSync(
            'node',
            [join(toolchain, 'bin/typescript.js'), 'check', '--json'],
            {
                cwd: directory,
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
