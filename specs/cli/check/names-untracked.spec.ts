import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

/*
 * A chain, for the ground's sake: an untracked folder needs a real repository
 * to be untracked IN — a fixture is copied whole, so every file it carries
 * would already be staged.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');

test('never reports a root nobody has git added, tracked or clean alike', () => {
    const project = mkdtempSync(resolve(tmpdir(), 'spec-names-untracked-'));

    try {
        // Given - a tracked project, and a local data/ folder nobody has staged
        writeFileSync(
            join(project, 'package.json'),
            `${JSON.stringify(
                { main: 'index.ts', name: 'spec-names-untracked', private: true, version: '1.0.0' },
                null,
                2,
            )}\n`,
        );
        writeFileSync(
            join(project, 'tsconfig.json'),
            '{ "compilerOptions": { "strict": true, "noEmit": true, "skipLibCheck": true }, "include": ["**/*.ts"] }\n',
        );
        writeFileSync(
            join(project, 'index.ts'),
            'export function run(): string {\n  return "ran";\n}\n',
        );
        execFileSync('git', ['init', '--quiet'], { cwd: project });
        execFileSync('git', ['add', 'package.json', 'tsconfig.json', 'index.ts'], { cwd: project });
        mkdirSync(join(project, 'data'));
        writeFileSync(join(project, 'data/report.txt'), 'a local scratch note, never staged\n');

        // When - the quality checks run without that folder ever staged
        const result = spawnSync('bash', [BIN, 'check'], { cwd: project, encoding: 'utf8' });
        const namesSection = result.stdout.slice(
            result.stdout.indexOf('Names (tree)'),
            result.stdout.indexOf('Secrets (credentials)'),
        );

        // Then - the untracked root is no finding, and the Names pass is green
        expect(namesSection).not.toContain('data/');
        expect(namesSection).toContain('Passed');
    } finally {
        rmSync(project, { force: true, recursive: true });
    }
});
