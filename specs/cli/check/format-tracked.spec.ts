import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, onTestFinished, test } from 'vitest';

/*
 * A chain, for the ground's sake: what separates a tracked file from an
 * untracked one is a repository, and a fixture cannot be one — the runner
 * copies files rather than initialising a repository.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');

const MISFORMATTED = 'export const shape = {wide:1}\n';

/** A repository with no oxfmt config, a misformatted ground file and a misformatted untracked one. */
function projectWith({ trackedSource }: { trackedSource: string }): string {
    const project = mkdtempSync(resolve(tmpdir(), 'spec-format-tracked-'));
    onTestFinished(() => {
        rmSync(project, { force: true, recursive: true });
    });
    writeFileSync(
        join(project, 'package.json'),
        `${JSON.stringify({ name: 'spec-format-tracked', version: '1.0.0', private: true }, null, 2)}\n`,
    );
    mkdirSync(join(project, 'src'));
    writeFileSync(join(project, 'src/index.ts'), trackedSource);
    mkdirSync(join(project, 'specs/fixtures'), { recursive: true });
    writeFileSync(join(project, 'specs/fixtures/broken.ts'), MISFORMATTED);
    execFileSync('git', ['init', '--quiet'], { cwd: project });
    execFileSync('git', ['add', '.'], { cwd: project });
    writeFileSync(join(project, 'scratch.ts'), MISFORMATTED);

    return project;
}

/** The Oxfmt pass of a run, from its header to its verdict. */
function formatPassOf(project: string, command: 'check' | 'fix'): string {
    const { stdout } = spawnSync('bash', [BIN, command], {
        cwd: project,
        encoding: 'utf8',
        env: { ...process.env, INIT_CWD: project },
    });

    const start = stdout.indexOf('Oxfmt');

    return stdout.slice(start, stdout.indexOf(' RUN ', start));
}

test('judges no ground file and no untracked file, with no oxfmt config to say so', () => {
    // Given - a tracked, formatted source file beside a misformatted ground file and a misformatted untracked file
    const project = projectWith({ trackedSource: 'export const shape = { wide: 1 };\n' });

    // When - the quality checks run
    const format = formatPassOf(project, 'check');

    // Then - the Oxfmt pass is green
    expect(format).toContain('Passed');
});

test('refuses a tracked source file it would reformat, and only that file', () => {
    // Given - the same project, whose tracked source file is misformatted
    const project = projectWith({ trackedSource: MISFORMATTED });

    // When - the quality checks run
    const format = formatPassOf(project, 'check');

    // Then - the Oxfmt pass fails on the source file alone
    expect(format).toContain('src/index.ts');
    expect(format).not.toContain('broken.ts');
    expect(format).not.toContain('scratch.ts');
    expect(format).toContain('Failed');
});

test('rewrites the tracked source file, and leaves the ground and the untracked file as they were', () => {
    // Given - the same project, whose tracked source file is misformatted
    const project = projectWith({ trackedSource: MISFORMATTED });

    // When - the fixes run
    formatPassOf(project, 'fix');

    // Then - the source file is formatted, and neither of the others moved
    expect(readFileSync(join(project, 'src/index.ts'), 'utf8')).not.toBe(MISFORMATTED);
    expect(readFileSync(join(project, 'specs/fixtures/broken.ts'), 'utf8')).toBe(MISFORMATTED);
    expect(readFileSync(join(project, 'scratch.ts'), 'utf8')).toBe(MISFORMATTED);
});
