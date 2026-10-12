import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { shapeOf } from '../build-steps.js';

function projectWith(manifest: object): string {
    const root = mkdtempSync(join(tmpdir(), 'build-steps-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    writeFileSync(join(root, 'package.json'), JSON.stringify(manifest));

    return root;
}

const dts = (root: string, kind?: 'api' | 'cli' | 'library'): boolean =>
    shapeOf(root, kind === undefined ? null : { kind, platform: 'node' }).dts;

describe('build-steps', () => {
    test('shapeOf — names as external the host modules whose types a manifest holds in any dependency field, scoped names unfolded, and not those whose package it holds too', () => {
        // Given - the types of four host modules, one in each field, a scoped one, and the types of a package the manifest also holds
        const root = projectWith({
            dependencies: { '@types/zed': '1' },
            devDependencies: { '@types/vscode': '1', '@types/real': '1', real: '1' },
            optionalDependencies: { '@types/optional': '1' },
            peerDependencies: { '@types/peer': '1', '@types/scope__pkg': '1' },
        });

        // Then - every host module of the four fields and the scoped one, sorted; the one with a package of its own left to the bundler
        expect(shapeOf(root, { kind: 'library', platform: 'node' }).external).toStrictEqual([
            '@scope/pkg',
            'optional',
            'peer',
            'vscode',
            'zed',
        ]);
    });

    test('shapeOf — a private library or cli emits no declaration, and a public one, an application and an undeclared project do', () => {
        // Given - a private and a public manifest read as each kind, and as none
        const privately = projectWith({ private: true });
        const publicly = projectWith({ name: 'x' });

        // Then - only a private library or cli drops its declarations
        expect([
            dts(privately, 'library'),
            dts(privately, 'cli'),
            dts(privately, 'api'),
            dts(privately),
            dts(publicly, 'library'),
        ]).toStrictEqual([false, false, true, true, true]);
    });

    test('shapeOf — a private library emits its declarations when a sibling member of its workspace depends on it, and none when no sibling does', () => {
        // Given - a workspace of three members: a private library, a sibling that depends on it, and a sibling that does not
        const workspace = projectWith({ private: true, workspaces: ['packages/*'] });
        const member = (name: string, manifest: object): string => {
            const dir = join(workspace, 'packages', name);
            mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest));

            return dir;
        };
        const read = member('read', { name: '@w/read', private: true });
        const unread = member('unread', { name: '@w/unread', private: true });
        member('server', { devDependencies: { '@w/read': '*' }, name: '@w/server' });

        // Then - only the library a sibling depends on keeps its declarations
        expect([dts(read, 'library'), dts(unread, 'library')]).toStrictEqual([true, false]);
    });
});
