import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';

/*
 * A chain, not a document — and the product command all the same. What no
 * document can state here is the GROUND: the Astro pass runs the CONSUMER's
 * `astro check`, and a fixture is copied rather than installed, so the only way
 * to stand the pass up is to build a project that declares the dependency and
 * carries a binary at the path npm would have put one. The formatter half is
 * real: prettier and prettier-plugin-astro are this package's own.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');

const project = mkdtempSync(resolve(tmpdir(), 'spec-astro-'));

afterAll(() => {
    rmSync(project, { force: true, recursive: true });
});

/** A stand-in for the checker an Astro project installs, saying it ran. */
function installAstroStub(): void {
    const binaries = join(project, 'node_modules/.bin');
    mkdirSync(binaries, { recursive: true });
    const stub = join(binaries, 'astro');
    writeFileSync(stub, '#!/bin/sh\necho "astro-check-ran"\nexit 0\n');
    chmodSync(stub, 0o755);
}

test('checks the templates and formats them, where the project declares astro', () => {
    // Given - a project that depends on astro, with one badly shaped template
    writeFileSync(
        join(project, 'package.json'),
        `${JSON.stringify(
            {
                dependencies: { astro: '^7.0.0' },
                name: 'spec-astro',
                private: true,
                version: '1.0.0',
            },
            null,
            2,
        )}\n`,
    );
    writeFileSync(
        join(project, 'tsconfig.json'),
        '{ "compilerOptions": { "strict": true, "noEmit": true }, "include": ["**/*.ts"] }\n',
    );
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src/page.astro'), '<p   class="wide"  >hello</p>\n');
    /* Tsc refuses a project with no input of its own, whatever the templates say. */
    writeFileSync(join(project, 'src/site.ts'), 'export const title = "spec";\n');
    installAstroStub();

    // When - the quality checks run there
    const result = spawnSync('bash', [BIN, 'check'], { cwd: project, encoding: 'utf8' });

    // Then - the pass ran the project's own checker and refused the template's shape
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Astro (check + format)');
    expect(result.stdout).toContain('astro-check-ran');
    expect(result.stdout).toContain('src/page.astro');

    // When - the same project is fixed
    const fixed = spawnSync('bash', [BIN, 'fix'], { cwd: project, encoding: 'utf8' });

    // Then - the formatter rewrote the template, so the check has nothing left to say
    expect(fixed.stdout).toContain('src/page.astro');
    const rechecked = spawnSync('bash', [BIN, 'check'], { cwd: project, encoding: 'utf8' });
    expect(rechecked.stdout).not.toContain('Astro (check + format)');
});
