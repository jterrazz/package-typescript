import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

/*
 * A chain, not a document, for the same reason the versions report is one:
 * every other line of `doctor` is a version, and a document stating one would
 * go red on a dependency bump with nothing wrong. What is claimed here is the
 * one verdict the project owns rather than the toolchain — and the ground is a
 * lockfile, which `fixture:` can spread but `INIT_CWD` is what the product
 * command reads, so the run names its own root.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');
const FIXTURES = resolve(import.meta.dirname, '_fixtures/browser-pin');

/** `typescript doctor` run as a consumer runs it, from inside the fixture. */
function doctorIn(fixture: string): { status: null | number; stdout: string } {
    const cwd = resolve(FIXTURES, fixture);
    const result = spawnSync('bash', [BIN, 'doctor'], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, INIT_CWD: cwd },
    });

    return { status: result.status, stdout: result.stdout };
}

describe('the browser provider pinned to its runner', () => {
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

    test('says so where the lockfile is one it does not parse', () => {
        // Given - a project declaring the provider under a lockfile this report cannot read
        // When - the doctor reads it
        const { status, stdout } = doctorIn('unread');

        // Then - the gap is stated rather than passed over, and it fails nothing
        expect(stdout).toContain('pnpm-lock.yaml is not parsed here');
        expect(status).toBe(0);
    });
});
