import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { declaredAnywhere } from '../declared.js';

function repositoryWith(manifests: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'doctor-declared-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    for (const [folder, text] of Object.entries(manifests)) {
        mkdirSync(join(root, folder), { recursive: true });
        writeFileSync(join(root, folder, 'package.json'), text);
    }

    return root;
}

const WORKSPACE = '{"name":"root","workspaces":["packages/*"]}';

describe('declaredAnywhere', () => {
    test('declaredAnywhere — a package is declared when the root or a member holds it among its dependencies, dev dependencies or peers', () => {
        // Given - a root declaring one package three ways, and a member declaring another
        const root = repositoryWith({
            '.': JSON.stringify({
                dependencies: { alpha: '1' },
                devDependencies: { beta: '1' },
                name: 'root',
                peerDependencies: { gamma: '1' },
                workspaces: ['packages/*'],
            }),
            'packages/app': '{"devDependencies":{"delta":"1"}}',
        });

        // Then - each is found, and one declared nowhere is not
        expect(
            ['alpha', 'beta', 'gamma', 'delta', 'epsilon'].map((name) =>
                declaredAnywhere(root, name),
            ),
        ).toStrictEqual([true, true, true, true, false]);
    });

    test('declaredAnywhere — a manifest that cannot be read declares nothing, and a package held in a field no install reads is not declared', () => {
        // Given - a member whose manifest is no JSON beside one that is fine, and a root holding the package only as an optional dependency
        const root = repositoryWith({
            '.': JSON.stringify({
                name: 'root',
                optionalDependencies: { zeta: '1' },
                workspaces: ['packages/*'],
            }),
            'packages/broken': '{"devDependencies":',
            'packages/fine': '{"dependencies":{"eta":"1"}}',
        });

        // Then - the broken member names nothing and breaks nothing, the sound one answers, the optional field does not count
        expect([
            declaredAnywhere(root, 'eta'),
            declaredAnywhere(root, 'theta'),
            declaredAnywhere(root, 'zeta'),
        ]).toStrictEqual([true, false, false]);
    });

    test('declaredAnywhere — a repository with no manifest declares nothing', () => {
        // Given - a folder holding no package.json
        const root = repositoryWith({});

        // Then - nothing is declared
        expect(declaredAnywhere(root, 'alpha')).toBe(false);
    });

    test('declaredAnywhere — a workspace root names its members through its manifest', () => {
        // Given - a manifest with workspaces, whose member declares the package
        const root = repositoryWith({
            '.': WORKSPACE,
            'packages/lib': '{"peerDependencies":{"iota":"1"}}',
        });

        // Then - the member's declaration counts
        expect(declaredAnywhere(root, 'iota')).toBe(true);
    });
});
