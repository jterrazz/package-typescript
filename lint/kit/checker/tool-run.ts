import { spawnSync } from 'node:child_process';
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { refusal } from '../catalogue/lesson.js';

export type ToolRun = { output: string; ran: boolean; status: number };

export function runTool(
    name: string,
    binary: string,
    args: readonly string[],
    root: string,
): ToolRun {
    // Stryker disable next-line StringLiteral: the streams are read through a template, which decodes a buffer to the same text
    const run = spawnSync(binary, args, { cwd: root, encoding: 'utf8' });
    if (run.error !== undefined) {
        const line = refusal({
            fix: `run 'npm install' so the ${name} @jterrazz/typescript pins is installed beside it, then run again`,
            found: `${name} could not be run — ${run.error.message}`,
            read: 'docs/reference/quality-checks.md#the-passes',
            why: `the pass hands the tree to ${name}, and a tool that never ran judged nothing`,
        });

        return { output: `${line}\n`, ran: false, status: 1 };
    }

    return {
        output: `${run.stdout ?? ''}${run.stderr ?? ''}`,
        ran: true,
        status: run.status ?? 1,
    };
}

/** What the tool prints on its stdout, and nothing where it cannot run or fails. */
export function toolOutput(binary: string, args: readonly string[], root: string): string {
    const run = spawnSync(binary, args, { cwd: root, encoding: 'utf8' });

    return run.status === 0 ? run.stdout : '';
}

// outside: gitleaks reads a directory, so the judged files are copied into one, each at the project's own path.
function stageFiles(root: string, files: readonly string[]): string {
    const staged = mkdtempSync(join(tmpdir(), 'typescript-secrets-'));
    for (const path of files) {
        const source = join(root, path);
        try {
            if (!lstatSync(source).isFile()) {
                continue;
            }
            mkdirSync(dirname(join(staged, path)), { recursive: true });
            copyFileSync(source, join(staged, path));
        } catch {
            // invariant: a file gone from the disk has nothing left to leak.
        }
    }

    return staged;
}

export function runGitleaks(root: string, files: readonly string[]): null | ToolRun {
    const probe = spawnSync('gitleaks', ['version'], { stdio: 'ignore' });
    if (probe.error !== undefined) {
        return null;
    }

    const staged = stageFiles(root, files);
    try {
        return runTool(
            'gitleaks',
            'gitleaks',
            ['dir', '.', '--no-banner', '--redact', '--exit-code', '1'],
            staged,
        );
    } finally {
        rmSync(staged, { force: true, recursive: true });
    }
}
