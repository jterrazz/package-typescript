import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { describe, expect, test } from 'vitest';

import { onlyPasses, passOf, SELECTING_BIN } from '../_setup/check-passes.js';
import { temporaryDirectory } from '../_setup/temporary-directory.js';

const SIX_TARGETS = [
    '.PHONY: install build lint fix test check',
    'install build lint fix test:',
    '\ttrue',
    'check: lint test',
    '',
].join('\n');

const FILES: Readonly<Record<string, string>> = {
    '.gitignore': 'src/Generated_Client/\nlint/scratch.ts\n.DS_Store\n',
    'lint/index.ts': 'export const rules = [];\n',
    'lint/scratch.ts': 'export const draft = 1;\n',
    Makefile: SIX_TARGETS,
    'package.json': `${JSON.stringify({ files: ['lint'], main: 'lint/index.ts', name: 'spec-names-ignored', private: true, version: '1.0.0' }, null, 2)}\n`,
    'src/Generated_Client/client.ts': 'export const client = 1;\n',
    'lint/.DS_Store': 'finder\n',
    'src/Shop_Cart/cart.ts': 'export const cart = 1;\n',
};

function repositoryWithIgnoredFiles(): string {
    const project = temporaryDirectory('spec-names-ignored-');
    for (const [path, text] of Object.entries(FILES)) {
        mkdirSync(dirname(join(project, path)), { recursive: true });
        writeFileSync(join(project, path), text);
    }
    execFileSync('git', ['init', '--quiet'], { cwd: project });

    return project;
}

describe('names-git-ignored', () => {
    test('judges the names git sees, and none it ignores', () => {
        // Given - a repository whose .gitignore names a generated folder, a scratch file of lint/ and Finder's files
        const project = repositoryWithIgnoredFiles();

        // When - the Names pass runs
        const { stdout } = spawnSync('node', [SELECTING_BIN, 'check'], {
            cwd: project,
            encoding: 'utf8',
            env: { ...process.env, ...onlyPasses('names'), INIT_CWD: project },
        });

        // Then - only the directory git sees is refused, and nothing it ignores is named
        expect(
            passOf(stripVTControlCharacters(stdout), 'Names (tree)')
                .split('\n')
                .slice(1)
                .map((line) => line.trim().split('  ').slice(0, 2).join('  '))
                .filter((line) => line !== ''),
        ).toStrictEqual([
            'names/directory-in-kebab-case  src/Shop_Cart/',
            '✗ Failed with exit code 1',
        ]);
    });
});
