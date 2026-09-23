import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, expect, onTestFinished, test } from 'vitest';

import manifest from '../../../package.json' with { type: 'json' };
import { toolchainWith } from '../toolchain-sandbox.js';

/*
 * A chain, not a document — and the product command all the same. What no
 * document can state here is the GROUND: a config that names
 * `@jterrazz/typescript/oxlint` has to RESOLVE it, and the spec runner copies a
 * fixture rather than installing one. So the project is built with the link npm
 * would have made, which is also the only honest way to read a real consumer
 * config: the drift report measures a project against the profile it extends,
 * and a project that extends nothing has nothing to have drifted from.
 *
 * The rows that read an INSTALL stand on a copy of the package beside one
 * that disagrees with its ranges (`toolchain-sandbox.ts`), linked the same way.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');
const PACKAGE_ROOT = resolve(import.meta.dirname, '../../..');

const project = mkdtempSync(resolve(tmpdir(), 'spec-drift-'));

afterAll(() => {
    rmSync(project, { force: true, recursive: true });
});

/** A project wired at this checkout the way an install would wire it. */
function stand(config: string): void {
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
    writeFileSync(join(project, 'oxlint.config.ts'), config);
}

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
    const silent = spawnSync('bash', [BIN, 'check'], { cwd: project, encoding: 'utf8' });

    // Then - the report names the profile, and refuses the rule turned off in silence
    expect(silent.stdout).toContain('Deviations from the profile');
    expect(silent.stdout).toContain('profile                   node');
    expect(silent.stdout).toContain(
        "drift-unreasoned  oxlint.config.ts  no-debugger is off and the line that turns it off carries no '// reason:'",
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
    const reasoned = spawnSync('bash', [BIN, 'check'], { cwd: project, encoding: 'utf8' });

    /*
     * The run's own exit code is not the claim here — a sandbox that links this
     * checkout into its node_modules lints and formats what it finds there,
     * which is this repository, not the case.
     */

    // Then - the rule is still REPORTED as off, and no longer refused: it is a decision now
    expect(reasoned.stdout).toContain('rules off vs profile      1 (no-debugger)');
    expect(reasoned.stdout).not.toContain('drift-unreasoned');
});

/** A node-profile project linked at `toolchain`, one reasoned suppression in its source. */
function suppressingProject(toolchain: string): string {
    const directory = mkdtempSync(resolve(tmpdir(), 'spec-drift-rows-'));
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });
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

test('counts the suppressions, and names a tool left behind its range', () => {
    // Given - a project with one reasoned suppression, on a toolchain whose knip claims 0.0.1
    const toolchain = toolchainWith({ knip: '0.0.1' });
    const directory = suppressingProject(toolchain);

    // When - the quality checks run there
    const result = spawnSync('bash', [join(toolchain, 'bin/typescript.sh'), 'check'], {
        cwd: directory,
        encoding: 'utf8',
    });
    const drift = result.stdout.slice(result.stdout.indexOf('Deviations from the profile'));

    // Then - the report counts the directive, and names the one tool that deviates
    expect(drift).toContain('suppressions              1\n');
    expect(drift).toContain('tool versions             knip 0.0.1 old\n');
});

test('prints the same reading for a machine under check --json', () => {
    // Given - the same project, on the same toolchain
    const toolchain = toolchainWith({ knip: '0.0.1' });
    const directory = suppressingProject(toolchain);

    // When - the quality checks run with --json
    const result = spawnSync('bash', [join(toolchain, 'bin/typescript.sh'), 'check', '--json'], {
        cwd: directory,
        encoding: 'utf8',
    });
    const start = result.stdout.indexOf('Deviations from the profile');
    const drift = result.stdout.slice(start, result.stdout.indexOf(' END ', start));
    const reading = drift.slice(drift.indexOf('{'), drift.lastIndexOf('}') + 1);

    // Then - the drift block is one JSON object carrying every row the human block prints
    expect(JSON.parse(reading)).toStrictEqual({
        baseline: null,
        profile: 'node',
        rulesOff: [],
        suppressions: 1,
        testBaseline: null,
        tools: [
            { installed: '0.0.1', name: 'knip', range: manifest.dependencies.knip, verdict: 'old' },
        ],
        unreasoned: [],
    });
});
