import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';

/*
 * A chain, not a document — and the product command all the same. What no
 * document can state here is the GROUND: a config that names
 * `@jterrazz/typescript/oxlint` has to RESOLVE it, and the spec runner copies a
 * fixture rather than installing one. So the project is built with the link npm
 * would have made, which is also the only honest way to read a real consumer
 * config: the drift report measures a project against the profile it extends,
 * and a project that extends nothing has nothing to have drifted from.
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
    expect(silent.stdout).toContain('profile               node');
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
    expect(reasoned.stdout).toContain('rules off vs profile  1 (no-debugger)');
    expect(reasoned.stdout).not.toContain('drift-unreasoned');
});
