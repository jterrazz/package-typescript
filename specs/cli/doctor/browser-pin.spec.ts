import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { TYPESCRIPT_BIN } from '../_setup/check-passes.js';

// Each run starts one directory above the fixture, as npm does from a workspace root: `INIT_CWD` is the project.

const FIXTURES = resolve(import.meta.dirname, '_fixtures/browser-pin');

function doctorIn(fixture: string): { status: null | number; stdout: string } {
    const root = resolve(FIXTURES, fixture);
    const result = spawnSync('node', [TYPESCRIPT_BIN, 'doctor'], {
        cwd: FIXTURES,
        encoding: 'utf8',
        env: { ...process.env, INIT_CWD: root },
    });

    return { status: result.status, stdout: result.stdout };
}

describe('browser-pin', () => {
    test('passes a lockfile that resolves both to the same version', () => {
        // Given - a project whose lockfile pins the provider at vitest's own version
        // When - the doctor reads it
        const { status, stdout } = doctorIn('matched');

        // Then - both are named, and nothing is owed
        expect(stdout).toContain('Pinned together');
        expect(stdout).toContain('vitest');
        expect(stdout).toContain('@vitest/browser-playwright');
        expect(stdout).toContain('ok');
        expect(status).toBe(0);
    });

    test('fails a lockfile one patch apart, naming both versions', () => {
        // Given - the same project with the provider a patch behind the runner
        // When - the doctor reads it
        const { status, stdout } = doctorIn('skewed');

        // Then - the report names both numbers and says what the pin owes
        expect(stdout).toContain('4.1.10');
        expect(stdout).toContain('4.1.9');
        expect(stdout).toContain('must equal it exactly');
        expect(status).toBe(1);
    });

    test('reads a bun.lock, trailing commas and all', () => {
        // Given - a bun workspace whose provider resolved a patch behind the runner
        // When - the doctor reads it
        const { status, stdout } = doctorIn('bun-skewed');

        // Then - the pin is checked, not passed over: bun.lock is JSON once the commas go
        expect(stdout).toContain('4.1.9');
        expect(stdout).toContain('must equal it exactly');
        expect(status).toBe(1);
    });

    test('says so where the lockfile is one it does not parse', () => {
        // Given - a project declaring the provider under a lockfile this report cannot read
        // When - the doctor reads it
        const { status, stdout } = doctorIn('unread');

        // Then - the gap is stated rather than passed over, and it fails nothing
        expect(stdout).toContain('pnpm-lock.yaml is not parsed here');
        expect(status).toBe(0);
    });

    test('states the gap for a provider declared by a member rather than the root', () => {
        // Given - a workspace whose root declares nothing and whose member runs browser mode
        // When - the doctor reads it under a lockfile it cannot parse
        const { status, stdout } = doctorIn('unread-member');

        // Then - the notice fires: the provider belongs to whichever package runs browser mode
        expect(stdout).toContain('pnpm-lock.yaml is not parsed here');
        expect(status).toBe(0);
    });
});
