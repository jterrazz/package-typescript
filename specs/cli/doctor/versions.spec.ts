import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import manifest from '../../../package.json' with { type: 'json' };
import { toolchainWith } from '../_setup/toolchain-sandbox.js';
import { cli } from '../cli.specification.js';

// value: every number here is a version, which a golden would pin to a dependency bump.

function doctorOf(root: string): { rows: string[]; status: null | number; verdict: string } {
    const result = spawnSync('node', [join(root, 'dist/typescript.js'), 'doctor'], {
        cwd: root,
        encoding: 'utf8',
    });
    const lines = result.stdout.split('\n');

    return {
        rows: lines.filter((line) => /^ {2}\S/u.test(line)),
        status: result.status,
        verdict: lines.find((line) => /^(?:A tool|Every tool|found: )/u.test(line)) ?? '',
    };
}

describe('versions', () => {
    test('reports every tool of the toolchain against the range this package declares', async () => {
        // Given - the toolchain installed as this repository's own devDependencies
        const result = await cli.exec('doctor');

        // Then - the report names each tool the passes spawn, node itself, and beside each the range the manifest declares
        expect(result.exitCode).toBe(0);
        expect(
            [
                'node',
                'tsc (Go)',
                'typescript',
                'oxlint',
                'oxfmt',
                'knip',
                'dependency-cruiser',
                'ls-lint',
                'rumdl',
                manifest.engines.node,
                ...(
                    [
                        '@ls-lint/ls-lint',
                        'dependency-cruiser',
                        'knip',
                        'oxfmt',
                        'oxlint',
                        'oxlint-tsgolint',
                        'rumdl',
                        'typescript',
                    ] as const
                ).map((name) => manifest.dependencies[name]),
                'Every tool is in range.',
            ].filter((expected) => !result.stdout.text.includes(expected)),
        ).toStrictEqual([]);

        // Then - nothing installed here is older than what the toolchain asks for
        expect(
            result.stdout.text.split('\n').filter((line) => / (?:old|absent)$/u.test(line)),
        ).toStrictEqual([]);
    });

    test.each([
        ['older than its range', { oxlint: '0.0.1' }, /^ {2}oxlint +0\.0\.1 +\S+ +old$/u],
        ['not installed', { knip: null }, /^ {2}knip +— +\S+ +absent$/u],
    ])('fails on a tool %s', (_, forged, row) => {
        // Given - a toolchain with that one tool forged
        const root = toolchainWith(forged);

        // When - the doctor reads it
        const { rows, status, verdict } = doctorOf(root);

        // Then - the row carries its verdict, and the report fails on it alone
        expect(rows).toContainEqual(expect.stringMatching(row));
        expect(verdict).toBe(
            'found: a tool is older than its range, or not installed — its row reads `old` or `absent` · why: a gate running an older tool enforces an older rulebook without saying so · fix: install what this release declares, then run `typescript doctor` again · read: docs/guides/adopt-a-stricter-release.md#the-two-gestures',
        );
        expect(status).toBe(1);
    });

    test('warns on a tool ahead of its range, and does not fail', () => {
        // Given - a toolchain whose oxfmt claims a release far past its range
        const root = toolchainWith({ oxfmt: '99.0.0' });

        // When - the doctor reads it
        const { rows, status, verdict } = doctorOf(root);

        // Then - the row says newer, the widest name keeps two spaces before its version, and the report leaves the decision to the project
        expect(rows).toContainEqual(expect.stringMatching(/^ {2}oxfmt +99\.0\.0 +\S+ +newer$/u));
        expect(rows).toContainEqual(expect.stringMatching(/^ {2}dependency-cruiser {2}\S/u));
        expect(verdict).toBe(
            'A tool ahead of its range may be fine; the toolchain does not get to decide.',
        );
        expect(status).toBe(0);
    });
});
