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
 *
 * Every run starts one directory ABOVE the fixture, which is the shape npm
 * gives a script started from a workspace root: `INIT_CWD` is the project and
 * the working directory is somebody else's. A run whose two agreed would hold
 * nothing about which of them the command reads.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');
const FIXTURES = resolve(import.meta.dirname, '_fixtures/browser-pin');

/** `typescript doctor` run as a consumer runs it: the fixture is `INIT_CWD`. */
function doctorIn(fixture: string): { status: null | number; stdout: string } {
    const root = resolve(FIXTURES, fixture);
    const result = spawnSync('bash', [BIN, 'doctor'], {
        cwd: FIXTURES,
        encoding: 'utf8',
        env: { ...process.env, INIT_CWD: root },
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
