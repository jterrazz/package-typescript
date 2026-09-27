import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

// What make does with a failing line is the claim, and no reading of the text can make it.

const ROOT = resolve(import.meta.dirname, '../../..');

function chapterRecipe(): string {
    const chapter = readFileSync(resolve(ROOT, 'docs/06-quality-checks.md'), 'utf8');
    const section = chapter.slice(chapter.indexOf('#### The six gestures'));
    const block = /```make\n(?<recipe>[\s\S]*?)```/u.exec(section)?.groups?.recipe;
    if (block === undefined) {
        throw new Error('the six gestures carry no `make` block');
    }
    return block;
}

function runFix(
    makefile: string,
    stubs: Record<string, string>,
): { calls: string; status: null | number } {
    const bin = mkdtempSync(join(tmpdir(), 'makefile-fix-'));
    onTestFinished(() => {
        rmSync(bin, { force: true, recursive: true });
    });
    const log = join(bin, 'calls.log');
    writeFileSync(log, '');
    for (const [command, body] of Object.entries(stubs)) {
        writeFileSync(join(bin, command), `#!/bin/sh\necho "${command} $*" >> "${log}"\n${body}\n`);
        chmodSync(join(bin, command), 0o755);
    }
    const run = spawnSync('make', ['-s', '-o', 'node_modules/.install', '-f', makefile, 'fix'], {
        cwd: bin,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` },
    });
    return { calls: readFileSync(log, 'utf8'), status: run.status };
}

describe('makefile', () => {
    test.each([
        { checker: 0, toolchain: 1 },
        { checker: 1, toolchain: 0 },
        { checker: 0, toolchain: 0 },
    ])(
        'the recipe the chapter hands consumers runs the checker first and the toolchain last, and fails when either did ($toolchain, $checker)',
        ({ checker, toolchain }) => {
            // Given - the chapter's recipe, over a toolchain fixer and a checker that exit as told
            const chapter = mkdtempSync(join(tmpdir(), 'makefile-chapter-'));
            onTestFinished(() => {
                rmSync(chapter, { force: true, recursive: true });
            });
            const makefile = join(chapter, 'Makefile');
            writeFileSync(makefile, chapterRecipe());

            // When - `make fix`
            const run = runFix(makefile, {
                npx: `if [ "$1" = typescript ]; then exit ${toolchain}; fi; exit ${checker}`,
            });

            // Then - both fixers ran, the formatter's last, and the verdict is theirs combined
            expect(run.calls).toBe('npx jterrazz-test-check --fix\nnpx typescript fix\n');
            expect(run.status === 0).toBe(toolchain === 0 && checker === 0);
        },
    );

    test("this repository runs its own fixer after the test checker's, even when the checker fails", () => {
        // Given - this repository's Makefile, over a test checker that fails
        const makefile = resolve(ROOT, 'Makefile');

        // When - `make fix`
        const run = runFix(makefile, { npm: 'exit 0', npx: 'exit 1' });

        // Then - the toolchain's fixer ran after it, and the run still fails
        expect(run.calls).toBe('npm run build\nnpx jterrazz-test-check --fix\nnpm run lint:fix\n');
        expect(run.status).not.toBe(0);
    });
});
