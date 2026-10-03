import { directory } from '@jterrazz/test';
import { spawnSync } from 'node:child_process';
import { cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { describe, expect, test } from 'vitest';

import { onlyPasses, TYPESCRIPT_BIN } from '../_setup/check-passes.js';
import { temporaryDirectory } from '../_setup/temporary-directory.js';
import { cli } from '../cli.specification.js';

// outside: a config in the folder above a project is never read; `fixture:` spreads into its cwd, so that case is built in a temp directory.

function checkBelowDecoy(): string {
    const tree = temporaryDirectory('spec-default-config-');
    cpSync(resolve(import.meta.dirname, '_fixtures/default-config/decoy-parent'), tree, {
        recursive: true,
    });
    const { stdout } = spawnSync('node', [TYPESCRIPT_BIN, 'check'], {
        cwd: join(tree, 'project'),
        encoding: 'utf8',
        env: { ...process.env, INIT_CWD: join(tree, 'project') },
    });

    return stripVTControlCharacters(stdout);
}

function verdictOf(stdout: string, label: string): string {
    return /✓ Passed|✗ Failed/u.exec(stdout.slice(stdout.indexOf(label)))?.[0] ?? 'absent';
}

describe('default-config', () => {
    test('hands a project with no config of its own the default, never the config above it', () => {
        // Given - a project with no oxlint or oxfmt config, under a folder whose configs turn `no-debugger` off and indent with tabs
        // When - the quality checks run from the project
        const stdout = checkBelowDecoy();

        // Then - the default profile reports the debugger, and the default formatter passes the four-space source and ignores public/
        expect(stdout).toContain('eslint(no-debugger)');
        expect(verdictOf(stdout, 'Oxlint Check')).toBe('✗ Failed');
        expect(verdictOf(stdout, 'Oxfmt Check')).toBe('✓ Passed');
    });

    test('leaves a project with a config of its own to it, and to the nested config beneath it', async () => {
        // Given - a project whose root config arms `eqeqeq` alone, and a nested config turning it off in src/legacy/
        // When - the quality checks run
        const result = await cli
            .with({ env: onlyPasses('oxlint') })
            .fixture(directory('./_fixtures/default-config/own-nested/'))
            .exec('check');

        // Then - the root `==` is reported, the nested one is not, and no rule of the default profile speaks
        const stdout = result.stdout.text;
        expect(stdout).toContain('eslint(eqeqeq)');
        expect(stdout).not.toContain('src/legacy/');
        expect(stdout).not.toContain('no-debugger');
    });
});
