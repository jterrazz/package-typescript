import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { MEMBER_DEPTH } from '../manifest.js';
import { pnpmWorkspacePatterns, workspaceMembers } from '../workspace-members.js';

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

const nested = (depth: number): string =>
    `${Array.from({ length: depth }, (_, index) => `d${String(index)}`).join('/')}/package.json`;

const PACKAGE = '{ "name": "member", "private": true }\n';

const workspaces = (...globs: string[]): string =>
    `${JSON.stringify({ name: 'root', private: true, workspaces: globs })}\n`;

describe('workspaceMembers', () => {
    test.each([
        ['a list of unquoted globs', 'packages:\n  - apps/*\n  - libs/*\n', ['apps/*', 'libs/*']],
        [
            'single quotes and double quotes',
            'packages:\n  - \'apps/*\'\n  - "libs/*"\n',
            ['apps/*', 'libs/*'],
        ],
        [
            'a comment on the key and on an item',
            'packages: # members\n  - apps/* # the apps\n',
            ['apps/*'],
        ],
        [
            'a long comment on the key, and a key with trailing blanks',
            'packages:   # all of them, listed below\n  - apps/*\n',
            ['apps/*'],
        ],
        [
            'several spaces after the dash and a tab indent',
            'packages:\n  -   apps/*\n\t- libs/*\n',
            ['apps/*', 'libs/*'],
        ],
        [
            'a negation, kept as written',
            'packages:\n  - apps/*\n  - "!apps/old"\n',
            ['apps/*', '!apps/old'],
        ],
        [
            'a line of another shape in the list, skipped',
            'packages:\n  - apps/*\n  # a note\n\n  - libs/*\n',
            ['apps/*', 'libs/*'],
        ],
        [
            'the next key, which ends the list',
            'packages:\n  - apps/*\ncatalog:\n  - not/a/member\n',
            ['apps/*'],
        ],
        [
            'an indented packages key, which is no member list',
            'catalog:\n  packages:\n    - nope/*\n',
            [],
        ],
        ['a packages key with a value on its line', 'packages: apps/*\n  - libs/*\n', []],
        ['a file with no packages key', 'onlyBuiltDependencies:\n  - esbuild\n', []],
        ['an item that is a key', 'packages:\n  - apps/*\n  name: value\n', ['apps/*']],
    ])('reads the packages of a pnpm file: %s', (_case, yaml, expected) => {
        // Given - a root holding that pnpm-workspace.yaml
        const root = tree({ 'pnpm-workspace.yaml': yaml });

        // Then - the globs it lists, in order
        expect(pnpmWorkspacePatterns(root)).toStrictEqual(expected);
    });

    test('reads no package from a root with no pnpm file', () => {
        // Given - a root holding no pnpm-workspace.yaml
        const root = tree({ 'package.json': PACKAGE });

        // Then - nothing listed
        expect(pnpmWorkspacePatterns(root)).toStrictEqual([]);
    });

    test('reads the members of a pnpm workspace from pnpm-workspace.yaml when the manifest declares none', () => {
        // Given - a root with no `workspaces`, a pnpm file with two globs, and members under them
        const root = tree({
            'apps/api/package.json': PACKAGE,
            'apps/web/package.json': PACKAGE,
            'libs/kit/package.json': PACKAGE,
            'libs/notes/readme.md': '# no manifest\n',
            'package.json': '{ "name": "root", "private": true }\n',
            'pnpm-workspace.yaml':
                'packages:\n  - \'apps/*\'\n  - "libs/*"\ncatalog:\n  - nothing/*\n',
            'scratch/other/package.json': PACKAGE,
        });

        // Then - the members the globs reach that hold a manifest
        expect(workspaceMembers(root)).toStrictEqual(['apps/api', 'apps/web', 'libs/kit']);
    });

    test('prefers the manifest’s workspaces to a pnpm file, and has no member where neither declares one', () => {
        // Given - a manifest naming one glob beside a pnpm file naming another, a root whose pnpm file lists no packages, and a folder with neither
        const named = tree({
            'apps/api/package.json': PACKAGE,
            'libs/kit/package.json': PACKAGE,
            'package.json': workspaces('libs/*'),
            'pnpm-workspace.yaml': 'packages:\n  - apps/*\n',
        });
        const silent = tree({
            'apps/api/package.json': PACKAGE,
            'package.json': '{ "name": "root" }\n',
            'pnpm-workspace.yaml': 'onlyBuiltDependencies:\n  - esbuild\n',
        });

        // Then - the manifest decides in the first; the others have no member
        expect([
            workspaceMembers(named),
            workspaceMembers(silent),
            workspaceMembers(tmpdir()),
        ]).toStrictEqual([['libs/kit'], [], []]);
    });

    test('matches a glob as the package managers do: a star stays in its folder, a double star crosses, a dot and a plus are themselves, a trailing slash is dropped, a negation is ignored', () => {
        // Given - members under a star, a double star, a literal with regex characters, and look-alikes of each
        const root = tree({
            'a/b/package.json': PACKAGE,
            'apps/deep/er/package.json': PACKAGE,
            'apps/one/package.json': PACKAGE,
            'libs/v1.0/package.json': PACKAGE,
            'libs/v100/package.json': PACKAGE,
            'tools/c++/package.json': PACKAGE,
            'tools/cxx/package.json': PACKAGE,
            'package.json': workspaces('apps/*', 'a/**/', 'libs/v1.0', 'tools/c++', '!apps/one'),
        });

        // Then - apps/one by the star (the negation excludes nothing), a/b by the double star, libs/v1.0 and tools/c++ as themselves; nothing deeper under a star, nothing by a dot or a plus read as a pattern
        expect(workspaceMembers(root)).toStrictEqual(['a/b', 'apps/one', 'libs/v1.0', 'tools/c++']);
    });

    test('walks past a folder with no manifest to the members beneath it, and stops at a member', () => {
        // Given - a double-star glob, a plain folder holding a member, and a member holding a member
        const root = tree({
            'group/inner/package.json': PACKAGE,
            'group/inner/nested/package.json': PACKAGE,
            'package.json': workspaces('**'),
        });

        // Then - the inner member is found by walking past `group/`, and its own nested manifest is not a member of the workspace
        expect(workspaceMembers(root)).toStrictEqual(['group/inner']);
    });

    test('leaves out dot folders, dist, node_modules and files, and reads down to MEMBER_DEPTH folders and no further', () => {
        // Given - members in a dot folder, in dist, in node_modules, a file named like a member, and members at the last depth read and one past it
        const root = tree({
            '.hidden/member/package.json': PACKAGE,
            [nested(MEMBER_DEPTH + 1)]: PACKAGE,
            [nested(MEMBER_DEPTH + 2)]: PACKAGE,
            'dist/member/package.json': PACKAGE,
            'file-member': 'a file, no folder\n',
            'node_modules/member/package.json': PACKAGE,
            'package.json': workspaces('**'),
        });
        const deepest = nested(MEMBER_DEPTH + 1).replace('/package.json', '');

        // Then - only the member at the depth the walk reaches
        expect(workspaceMembers(root)).toStrictEqual([deepest]);
    });
});
