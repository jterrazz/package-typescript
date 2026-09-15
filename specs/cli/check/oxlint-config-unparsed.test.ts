import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';

/*
 * A chain, not a document — and the product command all the same. What no
 * document can state here is the GROUND: oxlint LOADS every `oxlint.config.*`
 * it finds under the project, including one inside a tree its own
 * `ignorePatterns` excludes. A fixture carrying a config that cannot load
 * therefore fails THIS repository's own lint run, so the project is built in a
 * temp directory instead of committed.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');

const project = mkdtempSync(resolve(tmpdir(), 'spec-oxlint-config-'));

afterAll(() => {
    rmSync(project, { force: true, recursive: true });
});

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
