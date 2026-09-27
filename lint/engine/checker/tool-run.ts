import { spawnSync } from 'node:child_process';
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export type ToolRun = { output: string; status: number };

export function runTool(
    name: string,
    binary: string,
    args: readonly string[],
    root: string,
): ToolRun {
    const run = spawnSync(binary, args, { cwd: root, encoding: 'utf8' });
    if (run.error !== undefined) {
        return { output: `${name} could not be run: ${run.error.message}\n`, status: 1 };
    }

    return { output: `${run.stdout ?? ''}${run.stderr ?? ''}`, status: run.status ?? 1 };
}

// gitleaks reads a directory, so the judged files are copied into one, each at the project's own path.
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
            // A file gone from the disk has nothing left to leak.
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
