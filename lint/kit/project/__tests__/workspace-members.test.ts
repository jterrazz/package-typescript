import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { workspaceMembers } from '../workspace-members.js';

function tree(files: Readonly<Record<string, string>>): string {
    const root = mkdtempSync(join(tmpdir(), 'workspace-members-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }

    return root;
}

const PACKAGE = '{ "name": "member", "private": true }\n';

describe('workspaceMembers', () => {
    test('reads the members of a pnpm workspace from pnpm-workspace.yaml: quoted globs, a comment, and the keys after the list', () => {
        // Given - a root with no `workspaces` field, a pnpm file listing two globs (one quoted, one commented) then another key, and members and folders under them
        const root = tree({
            'apps/api/package.json': PACKAGE,
            'apps/web/package.json': PACKAGE,
            'libs/kit/package.json': PACKAGE,
            'libs/notes/readme.md': '# no manifest\n',
            'package.json': '{ "name": "root", "private": true }\n',
            'pnpm-workspace.yaml': [
                'packages:',
                "    - 'apps/*'",
                '    # the shared kits',
                '    - "libs/*" # one folder each',
                '    - "!libs/kit"',
                'catalog:',
                '    - nothing/*',
                '',
            ].join('\n'),
            'scratch/other/package.json': PACKAGE,
        });

        // Then - the members the globs reach that hold a manifest, the negation and the other key left alone
        expect(workspaceMembers(root)).toStrictEqual(['apps/api', 'apps/web', 'libs/kit']);
    });

    test('prefers the manifest’s workspaces to a pnpm file, and reads no member from a file with no packages list', () => {
        // Given - a manifest naming one glob beside a pnpm file naming another, and a root whose pnpm file lists no packages
        const named = tree({
            'apps/api/package.json': PACKAGE,
            'libs/kit/package.json': PACKAGE,
            'package.json': '{ "name": "root", "workspaces": ["libs/*"] }\n',
            'pnpm-workspace.yaml': 'packages:\n    - apps/*\n',
        });
        const silent = tree({
            'apps/api/package.json': PACKAGE,
            'package.json': '{ "name": "root" }\n',
            'pnpm-workspace.yaml': 'onlyBuiltDependencies:\n    - esbuild\n',
        });

        // Then - the manifest decides in the first; the second has no member
        expect([
            workspaceMembers(named),
            workspaceMembers(silent),
            workspaceMembers(tmpdir()),
        ]).toStrictEqual([['libs/kit'], [], []]);
    });
});
