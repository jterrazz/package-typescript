import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { declaredSubpaths } from './manifest.js';

function manifestAt(dir: string, manifest: unknown): void {
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'package.json'), JSON.stringify(manifest));
}

describe('manifest', () => {
    test('lists no subpath of an exports map that holds conditions alone', () => {
        // Given - an install whose exports map is the root's conditions
        const root = mkdtempSync(resolve(tmpdir(), 'pkg-exports-'));
        manifestAt(root, { exports: { default: './b.js', import: './a.js' }, name: 'conditional' });

        // Then - a condition is no subpath
        expect(declaredSubpaths('conditional', root)).toStrictEqual([]);
    });

    test('lists every subpath of the exports map, never the root', () => {
        // Given - an install whose manifest publishes two subpaths
        const root = mkdtempSync(resolve(tmpdir(), 'pkg-exports-'));
        manifestAt(root, {
            exports: { '.': {}, './oxlint': {}, './vitest': {} },
            name: '@jterrazz/test',
        });
        const dist = resolve(root, 'dist');
        mkdirSync(dist, { recursive: true });

        // Then - the root export is not a subpath; the other two are, specifier-formed
        expect(declaredSubpaths('@jterrazz/test', dist)).toStrictEqual([
            '@jterrazz/test/oxlint',
            '@jterrazz/test/vitest',
        ]);
    });

    test('reads an install in a gitignored node_modules — a dependency is read from the disk', () => {
        // Given - a consumer checkout that ignores node_modules, with the package installed as a copy under it
        const root = mkdtempSync(resolve(tmpdir(), 'pkg-exports-'));
        manifestAt(root, { name: 'some-consumer' });
        writeFileSync(resolve(root, '.gitignore'), 'node_modules/\n');
        execFileSync('git', ['init', '--quiet'], { cwd: root });
        const installed = resolve(root, 'node_modules/@jterrazz/test');
        manifestAt(installed, {
            exports: { '.': {}, './oxlint': {}, './vitest': {} },
            name: '@jterrazz/test',
        });
        const dist = resolve(installed, 'dist');
        mkdirSync(dist, { recursive: true });

        // Then - git's listing does not decide what a dependency publishes
        expect(declaredSubpaths('@jterrazz/test', dist)).toStrictEqual([
            '@jterrazz/test/oxlint',
            '@jterrazz/test/vitest',
        ]);
    });

    test('the walk stops at the first manifest — a host project vouches for nothing', () => {
        // Given - a consumer manifest sitting above, with subpaths of its own
        const root = mkdtempSync(resolve(tmpdir(), 'pkg-exports-'));
        manifestAt(root, { exports: { './anything': {} }, name: 'some-consumer' });
        const nested = resolve(root, 'node_modules/other/dist');
        mkdirSync(nested, { recursive: true });

        // Then - a foreign manifest ends the search: no exemption is inherited
        expect(declaredSubpaths('@jterrazz/test', nested)).toStrictEqual([]);
    });

    test('no manifest at all yields no exemption — `no-unpublished-subpath` applies plainly', () => {
        // Given - a directory with nothing above it to read
        const orphan = mkdtempSync(resolve(tmpdir(), 'pkg-exports-'));

        // Then - with no contract to read, no subpath can be vouched for
        expect(declaredSubpaths('@jterrazz/test', orphan)).toStrictEqual([]);
    });
});
