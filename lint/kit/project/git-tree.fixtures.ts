import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { vi } from 'vitest';

import { forgetTree } from './git-tree.js';

const REAL_GIT = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();

export function gitAsked(read: () => unknown): string[] {
    const shim = mkdtempSync(join(tmpdir(), 'git-shim-'));
    const log = join(shim, 'asked.log');
    writeFileSync(log, '');
    writeFileSync(
        join(shim, 'git'),
        `#!/bin/sh\necho "$1" >> '${log}'\nexec '${REAL_GIT}' "$@"\n`,
        {
            mode: 0o755,
        },
    );
    vi.stubEnv('PATH', `${shim}${delimiter}${process.env.PATH ?? ''}`);
    try {
        read();
    } finally {
        vi.unstubAllEnvs();
    }

    return readFileSync(log, 'utf8').split('\n').filter(Boolean);
}

export function project(files: string[], git?: { add: string[]; ignore?: string }): string {
    const root = mkdtempSync(join(tmpdir(), 'tree-'));
    for (const path of files) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), `${path}\n`);
    }
    if (git !== undefined) {
        if (git.ignore !== undefined) {
            writeFileSync(join(root, '.gitignore'), git.ignore);
        }
        execFileSync('git', ['init', '--quiet'], { cwd: root });
        if (git.add.length > 0) {
            execFileSync('git', ['add', ...git.add], { cwd: root });
        }
    }
    forgetTree();
    return root;
}
