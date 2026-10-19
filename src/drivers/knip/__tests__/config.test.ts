import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { gitIgnored } from '../config.js';

function folder(files: Readonly<Record<string, string>>): string {
    const root = mkdtempSync(join(tmpdir(), 'knip-config-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    for (const [file, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        writeFileSync(join(root, file), text);
    }

    return root;
}

describe('config', () => {
    test('gitIgnored — every folder and file git ignores, a nested .gitignore honoured, a folder as its glob and a name as git wrote it', () => {
        // Given - a repository ignoring a root file, a folder by a nested .gitignore, and a file whose name git would quote
        const root = folder({
            '.gitignore': '*.log\ncafé.ts\n',
            'debug.log': '',
            'café.ts': '',
            'src/index.ts': '',
            'work/.gitignore': '*\n!.gitignore\n',
            'work/repos/clone/src/orphan.ts': '',
        });
        execFileSync('git', ['init', '--quiet'], { cwd: root });

        // Then - the ignored file, the quoted one unquoted, and the ignored folder as a glob, and nothing outside a repository
        expect([gitIgnored(root).toSorted(), gitIgnored(tmpdir())]).toStrictEqual([
            ['café.ts', 'debug.log', 'work/repos/**'],
            [],
        ]);
    });
});
