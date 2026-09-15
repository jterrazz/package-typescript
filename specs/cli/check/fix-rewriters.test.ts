import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';

/*
 * A chain, for the ground's sake: the claim needs rules armed at `error` on a
 * file that is also badly formatted, and oxlint loads every config under this
 * repository — an armed one committed under `_fixtures/` would report on its
 * own broken tree during this repository's lint run
 * ([Testing](../../../docs/03-testing.md)).
 *
 * What it claims is the end of the gesture: after `fix`, `check` agrees. Run in
 * parallel, whichever of `oxlint --fix` and `oxfmt` finishes second writes its
 * copy of the file over the other's, and the check that follows fails on what
 * the fix had just settled — measured on package-test. The interleaving is not
 * deterministic, so this states the invariant the pair of gestures owes, not
 * the order they happen to take on one machine.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');

const project = mkdtempSync(resolve(tmpdir(), 'spec-fix-rewriters-'));

afterAll(() => {
    rmSync(project, { force: true, recursive: true });
});

test('leaves a tree that check passes, after both rewriters have run', () => {
    // Given - a project whose one file needs a lint fix AND a reformat
    writeFileSync(
        join(project, 'package.json'),
        `${JSON.stringify(
            { name: 'spec-fix-rewriters', private: true, type: 'module', version: '1.0.0' },
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
        'export default { rules: { "one-var": ["error", "never"] } };\n',
    );
    writeFileSync(
        join(project, 'index.ts'),
        'export const label = "x";\nexport const alpha = 1, beta = 2;\n',
    );

    // When - the two gestures, in the order a developer runs them
    const fixed = spawnSync('bash', [BIN, 'fix'], { cwd: project, encoding: 'utf8' });
    const checked = spawnSync('bash', [BIN, 'check'], { cwd: project, encoding: 'utf8' });

    // Then - the fix settled both rewriters' work, and the check agrees with it
    expect(fixed.status).toBe(0);
    expect(checked.status).toBe(0);
});
