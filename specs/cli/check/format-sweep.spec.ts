import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { temporaryDirectory } from '../../_shared/_setup/temporary-directory.js';
import { onlyPasses, passOf, SELECTING_BIN } from '../_setup/check-passes.js';

// outside: the runner copies files rather than initialising a repository, so a fixture cannot say what git ignores.

const MISFORMATTED = 'export const shape = {wide:1}\n';

const FORMATTED = 'export const shape = { wide: 1 };\n';

function projectWith({
    newSource,
    trackedSource,
}: {
    newSource: string;
    trackedSource: string;
}): string {
    const project = temporaryDirectory('spec-format-sweep-');
    writeFileSync(
        join(project, 'package.json'),
        `${JSON.stringify({ name: 'spec-format-sweep', version: '1.0.0', private: true }, null, 4)}\n`,
    );
    writeFileSync(join(project, '.gitignore'), 'local/\n');
    mkdirSync(join(project, 'src'));
    writeFileSync(join(project, 'src/index.ts'), trackedSource);
    mkdirSync(join(project, 'specs/_fixtures'), { recursive: true });
    writeFileSync(join(project, 'specs/_fixtures/broken.ts'), MISFORMATTED);
    mkdirSync(join(project, 'local'));
    writeFileSync(join(project, 'local/scratch.ts'), MISFORMATTED);
    execFileSync('git', ['init', '--quiet'], { cwd: project });
    execFileSync('git', ['add', '.'], { cwd: project });
    writeFileSync(join(project, 'src/added.ts'), newSource);

    return project;
}

function formatPassOf(project: string, command: 'check' | 'fix'): string {
    const { stdout } = spawnSync('node', [SELECTING_BIN, command], {
        cwd: project,
        encoding: 'utf8',
        env: { ...process.env, ...onlyPasses('oxfmt'), INIT_CWD: project },
    });

    return passOf(stdout, 'Oxfmt');
}

describe('format-sweep', () => {
    test('judges no ground file and no ignored file, with no oxfmt config to say so', () => {
        // Given - formatted source files, tracked and new, beside a misformatted ground file and a misformatted ignored file
        const project = projectWith({ newSource: FORMATTED, trackedSource: FORMATTED });

        // When - the quality checks run
        const format = formatPassOf(project, 'check');

        // Then - the Oxfmt pass is green
        expect(format).toContain('Passed');
    });

    test('refuses the source files it would reformat, tracked or new, and only those', () => {
        // Given - the same project, whose tracked source file and new source file are misformatted
        const project = projectWith({ newSource: MISFORMATTED, trackedSource: MISFORMATTED });

        // When - the quality checks run
        const format = formatPassOf(project, 'check');

        // Then - the Oxfmt pass fails on the two source files alone
        expect(format).toContain('src/index.ts');
        expect(format).toContain('src/added.ts');
        expect(format).not.toContain('broken.ts');
        expect(format).not.toContain('scratch.ts');
        expect(format).toContain('Failed');
    });

    test('rewrites the new file without a git add, and leaves the ground and the ignored file as they were', () => {
        // Given - the same project, whose tracked source file and new source file are misformatted
        const project = projectWith({ newSource: MISFORMATTED, trackedSource: MISFORMATTED });

        // When - the fixes run
        formatPassOf(project, 'fix');

        // Then - both source files are formatted, and neither of the others moved
        expect(readFileSync(join(project, 'src/index.ts'), 'utf8')).toBe(FORMATTED);
        expect(readFileSync(join(project, 'src/added.ts'), 'utf8')).toBe(FORMATTED);
        expect(readFileSync(join(project, 'specs/_fixtures/broken.ts'), 'utf8')).toBe(MISFORMATTED);
        expect(readFileSync(join(project, 'local/scratch.ts'), 'utf8')).toBe(MISFORMATTED);
    });
});
