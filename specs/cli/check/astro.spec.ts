import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { afterAll, describe, expect, test } from 'vitest';

import { onlyPasses, TYPESCRIPT_BIN } from '../_setup/check-passes.js';
import { newDirectory } from '../_setup/temporary-directory.js';

// outside: the Astro pass runs the consumer's `astro check`, so the project carries a binary where npm would put one.

const project = newDirectory('spec-astro-');

const workspace = newDirectory('spec-astro-workspace-');

afterAll(() => {
    rmSync(project, { force: true, recursive: true });
    rmSync(workspace, { force: true, recursive: true });
});

function installAstroStub(root: string): void {
    const binaries = join(root, 'node_modules/.bin');
    mkdirSync(binaries, { recursive: true });
    const stub = join(binaries, 'astro');
    writeFileSync(stub, '#!/bin/sh\necho "astro-check-ran"\nexit 0\n');
    chmodSync(stub, 0o755);
}

describe('astro', () => {
    test("refuses a template the project's own checker and the formatter both refuse", () => {
        // Given - a website declared on astro, with one badly shaped template
        writeFileSync(
            join(project, 'jterrazz.config.ts'),
            "export default { kind: 'website', platform: 'astro' };\n",
        );
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
        // outside: tsc refuses a project with no input of its own.
        writeFileSync(join(project, 'src/site.ts'), 'export const title = "spec";\n');
        installAstroStub(project);

        // When - the quality checks run there
        const result = spawnSync('node', [TYPESCRIPT_BIN, 'check'], {
            cwd: project,
            encoding: 'utf8',
        });

        // Then - the pass ran the project's own checker and refused the template's shape
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('Astro (check + format)');
        expect(result.stdout).toContain('astro-check-ran');
        expect(result.stdout).toContain('src/page.astro');
    });

    test('the formatter rewrites the template, and the pass has nothing left to say', () => {
        // Given - the project the case above left with a badly shaped template

        // When - the fixes run there
        const fixed = spawnSync('node', [TYPESCRIPT_BIN, 'fix'], {
            cwd: project,
            encoding: 'utf8',
        });

        // Then - the formatter named the file it rewrote
        expect(fixed.stdout).toContain('src/page.astro');

        // Then - and a second check no longer reports the pass at all
        const rechecked = spawnSync('node', [TYPESCRIPT_BIN, 'check'], {
            cwd: project,
            encoding: 'utf8',
        });
        expect(rechecked.stdout).not.toContain('astro-check-ran');
    });

    test('runs in the workspace member that declares astro, though the root declares no platform', () => {
        // Given - a workspace whose one member is a website on astro, with a badly shaped template, astro hoisted to the root
        writeFileSync(
            join(workspace, 'package.json'),
            `${JSON.stringify({ name: 'spec-astro-workspace', private: true, workspaces: ['packages/*'] }, null, 2)}\n`,
        );
        writeFileSync(
            join(workspace, 'jterrazz.config.ts'),
            "export default { kind: 'workspace' };\n",
        );
        const site = join(workspace, 'packages/site');
        mkdirSync(join(site, 'src'), { recursive: true });
        writeFileSync(
            join(site, 'package.json'),
            `${JSON.stringify({ name: 'site', private: true, version: '1.0.0' }, null, 2)}\n`,
        );
        writeFileSync(
            join(site, 'jterrazz.config.ts'),
            "export default { kind: 'website', platform: 'astro' };\n",
        );
        writeFileSync(join(site, 'src/page.astro'), '<p   class="wide"  >hello</p>\n');
        installAstroStub(workspace);

        // When - the Astro pass runs at the workspace root
        const result = spawnSync('node', [TYPESCRIPT_BIN, 'check'], {
            cwd: workspace,
            encoding: 'utf8',
            env: { ...process.env, ...onlyPasses('astro') },
        });

        // Then - it ran the member's checker and refused the member's template
        expect(result.status).toBe(1);
        expect(result.stdout).toMatch(/packages\/site\nastro-check-ran[\s\S]*src\/page\.astro/u);
    });
});
