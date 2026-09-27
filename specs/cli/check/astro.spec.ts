import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { newDirectory } from '../_setup/temporary-directory.js';

// The Astro pass runs the consumer's `astro check`, so the project carries a binary where npm would put one.

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.js');

const project = newDirectory('spec-astro-');

afterAll(() => {
    rmSync(project, { force: true, recursive: true });
});

function installAstroStub(): void {
    const binaries = join(project, 'node_modules/.bin');
    mkdirSync(binaries, { recursive: true });
    const stub = join(binaries, 'astro');
    writeFileSync(stub, '#!/bin/sh\necho "astro-check-ran"\nexit 0\n');
    chmodSync(stub, 0o755);
}

describe('astro', () => {
    test("refuses a template the project's own checker and the formatter both refuse", () => {
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
        // tsc refuses a project with no input of its own.
        writeFileSync(join(project, 'src/site.ts'), 'export const title = "spec";\n');
        installAstroStub();

        // When - the quality checks run there
        const result = spawnSync('node', [BIN, 'check'], { cwd: project, encoding: 'utf8' });

        // Then - the pass ran the project's own checker and refused the template's shape
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('Astro (check + format)');
        expect(result.stdout).toContain('astro-check-ran');
        expect(result.stdout).toContain('src/page.astro');
    });

    test('the formatter rewrites the template, and the pass has nothing left to say', () => {
        // Given - the project the case above left with a badly shaped template

        // When - the fixes run there
        const fixed = spawnSync('node', [BIN, 'fix'], { cwd: project, encoding: 'utf8' });

        // Then - the formatter named the file it rewrote
        expect(fixed.stdout).toContain('src/page.astro');

        // Then - and a second check no longer reports the pass at all
        const rechecked = spawnSync('node', [BIN, 'check'], { cwd: project, encoding: 'utf8' });
        expect(rechecked.stdout).not.toContain('astro-check-ran');
    });
});
