import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';

/*
 * A chain, for the ground's sake: the claim needs the rule armed at `error`,
 * and oxlint loads every config under this repository — an armed one committed
 * under `_fixtures/` would report on its own broken tree during this
 * repository's lint run ([Testing](../../../docs/03-testing.md)).
 *
 * `unicorn/no-useless-undefined` stands for the eight: its fixer strips an
 * argument the callee requires, so `fix` must leave the line alone while
 * `check` keeps reporting it — the answer is a human's.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');

const project = mkdtempSync(resolve(tmpdir(), 'spec-unsafe-fixers-'));

afterAll(() => {
    rmSync(project, { force: true, recursive: true });
});

const SOURCE = `export function take(value: string | undefined): string {
    return value ?? 'none';
}

export const taken = take(undefined);
`;

test('leaves a meaning-changing fixer alone and still reports it', () => {
    // Given - a project whose only diagnostic is one of the unsafe fixers
    writeFileSync(
        join(project, 'package.json'),
        `${JSON.stringify(
            { name: 'spec-unsafe-fixers', private: true, type: 'module', version: '1.0.0' },
            null,
            2,
        )}\n`,
    );
    writeFileSync(
        join(project, 'tsconfig.json'),
        '{ "compilerOptions": { "strict": true, "noEmit": true }, "include": ["index.ts"] }\n',
    );
    writeFileSync(
        join(project, 'oxlint.config.ts'),
        'export default { plugins: ["unicorn"], rules: { "unicorn/no-useless-undefined": "error" } };\n',
    );
    writeFileSync(join(project, 'index.ts'), SOURCE);

    // When - the fix runs
    const fixed = spawnSync('bash', [BIN, 'fix'], { cwd: project, encoding: 'utf8' });

    // Then - the argument is still there, and the pass is green about it
    expect(fixed.status).toBe(0);
    expect(readFileSync(join(project, 'index.ts'), 'utf8')).toContain('take(undefined)');

    // Then - the check still names the rule, because the answer is a human's
    const checked = spawnSync('bash', [BIN, 'check'], { cwd: project, encoding: 'utf8' });
    expect(checked.status).toBe(1);
    expect(checked.stdout).toContain('no-useless-undefined');
});
