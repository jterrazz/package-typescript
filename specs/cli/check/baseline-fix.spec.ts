import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';

/*
 * A chain, not a document, for the ground's sake: the claim needs a rule armed
 * at `error`, so that oxlint's own exit code is 1 and only the ratchet can make
 * the run green. oxlint LOADS every config it finds under this repository,
 * fixtures included, so an armed config committed under `_fixtures/` would
 * report on its own broken tree during this repository's lint run
 * ([Testing](../../../docs/03-testing.md)). The project is built in a temp
 * directory instead.
 *
 * What it proves is the pair: `fix` and `check` read the same verdict on the
 * same tree. Judging only `check` by the baseline made `make fix && make check`
 * print red then green wherever a project kept one.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');

const project = mkdtempSync(resolve(tmpdir(), 'spec-baseline-fix-'));

afterAll(() => {
    rmSync(project, { force: true, recursive: true });
});

test('passes fix and check alike on a tree whose diagnostics stay within the baseline', () => {
    // Given - a project whose two `debugger` statements are at `error` and recorded
    writeFileSync(
        join(project, 'package.json'),
        `${JSON.stringify(
            { name: 'spec-baseline-fix', private: true, type: 'module', version: '1.0.0' },
            null,
            2,
        )}\n`,
    );
    writeFileSync(
        join(project, 'tsconfig.json'),
        '{ "compilerOptions": { "strict": true, "noEmit": true }, "include": ["index.ts"] }\n',
    );
    writeFileSync(
        join(project, 'index.ts'),
        'export function first(): void {\n    debugger;\n}\n\nexport function second(): void {\n    debugger;\n}\n',
    );
    writeFileSync(
        join(project, 'oxlint.config.ts'),
        'export default { rules: { "no-debugger": "error" } };\n',
    );
    writeFileSync(join(project, 'oxlint.baseline.json'), '{\n  "eslint/no-debugger": 2\n}\n');

    // When - the two gestures a developer runs back to back
    const fixed = spawnSync('bash', [BIN, 'fix'], { cwd: project, encoding: 'utf8' });
    const checked = spawnSync('bash', [BIN, 'check'], { cwd: project, encoding: 'utf8' });

    // Then - both are green: the ratchet, not oxlint's exit code, is the verdict in either mode
    expect(fixed.status).toBe(0);
    expect(checked.status).toBe(0);
});
