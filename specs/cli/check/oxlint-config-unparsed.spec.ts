import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { newDirectory, temporaryDirectory } from '../temporary-directory.js';

// oxlint loads every `oxlint.config.*` under the project, even one its `ignorePatterns` excludes, so a
// config that cannot load is built in a temp directory. No oxlint run today exits 1 with no diagnostic, so
// the judge is run directly on that report shape.

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');
const JUDGE = resolve(import.meta.dirname, '../../../lint/ratchet/baseline.js');

const project = newDirectory('spec-oxlint-config-');

afterAll(() => {
    rmSync(project, { force: true, recursive: true });
});

function projectOf(files: Record<string, string>): string {
    const directory = temporaryDirectory('spec-oxlint-refusal-');
    for (const [path, content] of Object.entries(files)) {
        writeFileSync(join(directory, path), content);
    }

    return directory;
}

describe('oxlint-config-unparsed', () => {
    test('fails the oxlint pass when the config names a JS plugin that is not there', () => {
        // Given - a project whose oxlint config loads a plugin module nobody wrote
        writeFileSync(
            join(project, 'package.json'),
            `${JSON.stringify(
                { name: 'spec-oxlint-config', private: true, type: 'module', version: '1.0.0' },
                null,
                2,
            )}\n`,
        );
        writeFileSync(
            join(project, 'tsconfig.json'),
            '{ "compilerOptions": { "strict": true, "noEmit": true }, "include": ["index.ts"] }\n',
        );
        writeFileSync(join(project, 'index.ts'), 'export const title = "spec";\n');
        writeFileSync(
            join(project, 'oxlint.config.ts'),
            'export default { jsPlugins: ["./nowhere.js"], rules: { "no-debugger": "error" } };\n',
        );

        // When - the quality checks run there
        const result = spawnSync('bash', [BIN, 'check'], { cwd: project, encoding: 'utf8' });

        // Then - oxlint's own report is printed, and the pass names the refusal in its own vocabulary
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('Failed to parse oxlint configuration file');
        expect(result.stdout).toContain(
            'oxlint-config-unparsed  oxlint.config.ts  oxlint refused this config and linted nothing',
        );
    });

    test('fails the oxlint pass when the linter hands back no JSON report to judge', () => {
        // Given - a project whose oxlint config ignores the one source file it has, so oxlint lints nothing
        const directory = projectOf({
            '.oxlintrc.json': '{ "ignorePatterns": ["index.ts"] }\n',
            'index.ts': 'export const title = "spec";\n',
            'package.json':
                '{ "name": "spec-oxlint-refusal", "private": true, "type": "module" }\n',
            'tsconfig.json':
                '{ "compilerOptions": { "strict": true, "noEmit": true }, "include": ["index.ts"] }\n',
        });

        // When - the quality checks run there
        const result = spawnSync('bash', [BIN, 'check'], { cwd: directory, encoding: 'utf8' });
        const lint = result.stdout.slice(
            result.stdout.indexOf('Oxlint Check'),
            result.stdout.indexOf('Oxfmt Check'),
        );

        // Then - the judge says it had no report to read, and the pass fails
        expect(lint).toMatch(/oxlint wrote no JSON report at \S+ — the baseline cannot be read/u);
        expect(lint).toContain('Failed with exit code 1');
    });

    test('refuses a failing linter exit that no diagnostic explains', () => {
        // Given - an empty report beside a linter that exited 2
        const directory = projectOf({ 'lint.json': '{ "diagnostics": [] }\n' });

        // When - the ratchet judges that run
        const result = spawnSync('node', [JUDGE, 'lint.json', '.', '--linter-exit', '2'], {
            cwd: directory,
            encoding: 'utf8',
        });

        // Then - nothing is forgiven: the judge names the exit and fails
        expect(result.stdout).toBe(
            'oxlint exited 2 with no diagnostic — its own output says why\n',
        );
        expect(result.status).toBe(1);
    });
});
