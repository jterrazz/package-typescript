import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import manifest from '../../../package.json' with { type: 'json' };
import { toolchainWith } from '../_setup/toolchain-sandbox.js';
import { cli } from '../cli.specification.js';

// Every number here is a version, which a golden would pin to a dependency bump.

function doctorOf(root: string): { rows: string[]; status: null | number; verdict: string } {
    const result = spawnSync('node', [join(root, 'bin/typescript.js'), 'doctor'], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, INIT_CWD: root },
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

        // Then - the report names each tool the passes spawn, and node itself
        expect(result.exitCode).toBe(0);
        for (const tool of ['node', 'tsc (Go)', 'typescript', 'oxlint', 'oxfmt', 'knip']) {
            expect(result.stdout.text).toContain(tool);
        }

        // Then - the range beside each one is the range the manifest declares
        for (const name of ['knip', 'oxfmt', 'oxlint', 'oxlint-tsgolint', 'typescript'] as const) {
            expect(result.stdout.text).toContain(manifest.dependencies[name]);
        }
        expect(result.stdout.text).toContain(manifest.engines.node);

        // Then - nothing installed here is older than what the toolchain asks for
        expect(result.stdout.text).not.toContain('old');
        expect(result.stdout.text).not.toContain('absent');
        expect(result.stdout.text).toContain('Every tool is in range.');
    });

    test('fails on a tool older than its range, and on one that is not installed', () => {
        // Given - a toolchain whose oxlint claims 0.0.1 and whose knip is missing
        const root = toolchainWith({ knip: null, oxlint: '0.0.1' });

        // When - the doctor reads it
        const { rows, status, verdict } = doctorOf(root);

        // Then - each row carries its verdict, and the report fails on both
        expect(rows).toContainEqual(expect.stringMatching(/^ {2}oxlint +0\.0\.1 +\S+ +old$/u));
        expect(rows).toContainEqual(expect.stringMatching(/^ {2}knip +— +\S+ +absent$/u));
        expect(verdict).toBe(
            'found: a tool is older than its range, or not installed — its row reads `old` or `absent` · why: a gate running an older tool enforces an older rulebook without saying so · fix: install what this release declares, then run `typescript doctor` again · read: docs/04-operating.md#adopting-a-stricter-release',
        );
        expect(status).toBe(1);
    });

    test('warns on a tool ahead of its range, and does not fail', () => {
        // Given - a toolchain whose oxfmt claims a release far past its range
        const root = toolchainWith({ oxfmt: '99.0.0' });

        // When - the doctor reads it
        const { rows, status, verdict } = doctorOf(root);

        // Then - the row says newer, and the report leaves the decision to the project
        expect(rows).toContainEqual(expect.stringMatching(/^ {2}oxfmt +99\.0\.0 +\S+ +newer$/u));
        expect(verdict).toBe(
            'A tool ahead of its range may be fine; the toolchain does not get to decide.',
        );
        expect(status).toBe(0);
    });
});
