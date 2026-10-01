import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { TYPESCRIPT_BIN } from '../_setup/check-passes.js';
import { newDirectory } from '../_setup/temporary-directory.js';

// A coordinate git ignores needs a real repository, and a fixture cannot be one.

const project = newDirectory('spec-markdown-ignored-');

afterAll(() => {
    rmSync(project, { force: true, recursive: true });
});

describe('markdown-ignored', () => {
    test('forgives a page naming a build product git ignores, and refuses one naming nothing', () => {
        // Given - a repository whose README names its ignored bundle and a path nobody ignores
        execFileSync('git', ['init', '--quiet'], { cwd: project });
        writeFileSync(
            join(project, 'package.json'),
            `${JSON.stringify({ name: 'spec-markdown-ignored', version: '1.0.0', private: true, type: 'module' }, null, 2)}\n`,
        );
        writeFileSync(
            join(project, 'tsconfig.json'),
            '{ "compilerOptions": { "strict": true, "noEmit": true }, "include": ["index.ts"] }\n',
        );
        writeFileSync(join(project, 'oxlint.config.ts'), 'export default {};\n');
        writeFileSync(join(project, 'index.ts'), 'export const answer = 42;\n');
        writeFileSync(join(project, '.gitignore'), 'node_modules/\n.artifacts/\ndist/\n');
        mkdirSync(join(project, 'apps/web'), { recursive: true });
        writeFileSync(
            join(project, 'README.md'),
            'The bundle lands at `apps/web/dist/index.js`, the unpacked tree at `apps/web/dist`, once built; the notes at `apps/notes/absent.md` never existed.\n',
        );
        execFileSync('git', ['add', '.'], { cwd: project });

        // When - the check runs
        const checked = spawnSync('node', [TYPESCRIPT_BIN, 'check'], {
            cwd: project,
            encoding: 'utf8',
        });

        // Then - the ignored bundle is no finding, the absent notes are
        expect(checked.stdout).not.toContain('`apps/web/dist/index.js` names nothing');
        expect(checked.stdout).not.toContain('`apps/web/dist` names nothing');
        expect(checked.stdout).toContain('`apps/notes/absent.md` names nothing on disk');
    });
});
