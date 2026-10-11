import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, onTestFinished, test, vi } from 'vitest';

import {
    bunVersions,
    npmVersions,
    pinnedPair,
    reportPinnedPair,
    versionColumn,
} from '../pinned-pair.js';

const PROVIDER = '@vitest/browser-playwright';

afterEach(() => {
    vi.restoreAllMocks();
});

function projectWith(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'doctor-pair-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    for (const [name, text] of Object.entries(files)) {
        mkdirSync(join(root, name, '..'), { recursive: true });
        writeFileSync(join(root, name), text);
    }

    return root;
}

const npmLock = (packages: Record<string, unknown>): string => JSON.stringify({ packages });

const lock = (provider: string[], runner: string[]): string =>
    npmLock({
        ...Object.fromEntries(
            provider.map((version, index) => [
                `${'node_modules/x/'.repeat(index)}node_modules/${PROVIDER}`,
                { version },
            ]),
        ),
        ...Object.fromEntries(
            runner.map((version, index) => [
                `${'node_modules/y/'.repeat(index)}node_modules/vitest`,
                { version },
            ]),
        ),
    });

const pairOf = (provider: string[], runner: string[]): unknown =>
    pinnedPair(projectWith({ 'package-lock.json': lock(provider, runner) }));

const DECLARES = JSON.stringify({ devDependencies: { [PROVIDER]: '^4' } });

function printed(work: () => unknown): { result: unknown; text: string } {
    const chunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        chunks.push(String(chunk));
        return true;
    });
    const result = work();

    return { result, text: chunks.join('') };
}

describe('pinnedPair', () => {
    test('npmVersions — reads the version of every copy of a package, nested ones too, and of no package whose path only ends alike', () => {
        // Given - the package at the top, nested under another, a package with the name as a prefix, a path with the name past a slash only, an entry with no version
        const text = npmLock({
            '': { version: '0.0.0' },
            'node_modules/a/node_modules/vitest': { version: '4.1.9' },
            'node_modules/not-vitest': { version: '9.9.9' },
            'node_modules/vitest': { version: '4.1.10' },
            'node_modules/vitest-extra': { version: '7.7.7' },
            'vendor/vitest': { version: '5.0.0' },
            'node_modules/b/node_modules/vitest': {},
        });

        // Then - the two copies, in the order the lock lists them
        expect([...npmVersions(text, 'vitest')]).toStrictEqual(['4.1.9', '4.1.10']);
    });

    test('npmVersions — a lock with no packages names nothing', () => {
        // Given - a lock of another shape
        // Then - no version
        expect([...npmVersions('{}', 'vitest')]).toStrictEqual([]);
    });

    test('bunVersions — reads a lock that is JSON with trailing commas: the version after the last at-sign of the descriptor, for the name and its nested copies alone', () => {
        // Given - a bun.lock with a trailing comma in a list and an object, a scoped package, a nested copy, a longer name, and a bare string descriptor
        const text = `{
            "lockfileVersion": 1,
            "packages": {
                "vitest": ["vitest@4.1.10", "", {}, "sha",],
                "a/vitest": ["vitest@4.1.9", "", {},],
                "vitest-extra": ["vitest-extra@7.7.7", "", {}],
                "not-vitest": ["not-vitest@9.9.9", "", {}],
                "${PROVIDER}": ["${PROVIDER}@4.1.10", "", {}],
                "b/vitest": "vitest@4.1.8",
                "c/vitest": [3],
            },
        }`;

        // Then - the three copies of vitest, and the scoped provider read through its own at-sign
        expect([[...bunVersions(text, 'vitest')], [...bunVersions(text, PROVIDER)]]).toStrictEqual([
            ['4.1.10', '4.1.9', '4.1.8'],
            ['4.1.10'],
        ]);
    });

    test('versionColumn — a missing version is a dash, versions are joined by a comma', () => {
        // Given - none, one and two versions
        // Then - the dash, the one, the two
        expect([
            versionColumn([]),
            versionColumn(['4.1.10']),
            versionColumn(['1', '2']),
        ]).toStrictEqual(['—', '4.1.10', '1, 2']);
    });

    test('pinnedPair — reads nothing from a project with no lockfile, and from one whose lock names no provider', () => {
        // Given - a project with no lock, and one whose lock holds vitest alone
        const bare = projectWith({ 'package.json': DECLARES });
        const alone = projectWith({
            'package-lock.json': npmLock({ 'node_modules/vitest': { version: '4.1.10' } }),
            'package.json': DECLARES,
        });

        // Then - neither has a pair
        expect([pinnedPair(bare), pinnedPair(alone)]).toStrictEqual([null, null]);
    });

    test('pinnedPair — a lock whose provider and runner are one version is ok, listed in sorted order', () => {
        // Given - a lock holding both at 4.1.10
        const root = projectWith({
            'package-lock.json': npmLock({
                [`node_modules/${PROVIDER}`]: { version: '4.1.10' },
                'node_modules/vitest': { version: '4.1.10' },
            }),
        });

        // Then - ok, with both lists
        expect(pinnedPair(root)).toStrictEqual({
            provider: ['4.1.10'],
            runner: ['4.1.10'],
            verdict: 'ok',
        });
    });

    test('pinnedPair — a runner the lock lacks, a provider with two versions, a runner with two, and a patch apart are each skewed', () => {
        // Given - the four skews

        // Then - each verdict is skewed, the lists as the lock holds them sorted
        expect([
            pairOf(['4.1.10'], []),
            pairOf(['4.1.10', '4.1.9'], ['4.1.10']),
            pairOf(['4.1.10'], ['4.1.9', '4.1.10']),
            pairOf(['4.1.9'], ['4.1.10']),
        ]).toStrictEqual([
            { provider: ['4.1.10'], runner: [], verdict: 'skewed' },
            { provider: ['4.1.10', '4.1.9'], runner: ['4.1.10'], verdict: 'skewed' },
            { provider: ['4.1.10'], runner: ['4.1.10', '4.1.9'], verdict: 'skewed' },
            { provider: ['4.1.9'], runner: ['4.1.10'], verdict: 'skewed' },
        ]);
    });

    test('pinnedPair — a lock the project reads first wins: the npm lock before the shrinkwrap before bun’s', () => {
        // Given - a bun lock agreeing and an npm lock skewed, then a bun lock alone
        const both = projectWith({
            'bun.lock': `{"packages":{"vitest":["vitest@4.1.10"],"${PROVIDER}":["${PROVIDER}@4.1.10"]}}`,
            'package-lock.json': npmLock({
                [`node_modules/${PROVIDER}`]: { version: '4.1.9' },
                'node_modules/vitest': { version: '4.1.10' },
            }),
        });
        const bunAlone = projectWith({
            'bun.lock': `{"packages":{"vitest":["vitest@4.1.10"],"${PROVIDER}":["${PROVIDER}@4.1.10"],},}`,
        });
        const shrinkwrap = projectWith({
            'npm-shrinkwrap.json': npmLock({
                [`node_modules/${PROVIDER}`]: { version: '4.1.10' },
                'node_modules/vitest': { version: '4.1.10' },
            }),
        });

        // Then - the npm lock's verdict, then bun's, then the shrinkwrap's
        expect(
            [both, bunAlone, shrinkwrap].map((root) => {
                const pair = pinnedPair(root);
                return pair === null ? null : pair.verdict;
            }),
        ).toStrictEqual(['skewed', 'ok', 'ok']);
    });

    test('pinnedPair — a lock that cannot be parsed reads as no pair, and one the toolchain does not parse is named when the provider is declared', () => {
        // Given - a broken npm lock, and a yarn lock beside a manifest declaring the provider, and beside one that does not
        const broken = projectWith({ 'package-lock.json': '{"packages":' });
        const yarn = projectWith({ 'package.json': DECLARES, 'yarn.lock': '' });
        const yarnUndeclared = projectWith({ 'package.json': '{}', 'yarn.lock': '' });
        const pnpm = projectWith({ 'package.json': DECLARES, 'pnpm-lock.yaml': '' });
        const bunBinary = projectWith({ 'bun.lockb': '', 'package.json': DECLARES });

        // Then - the broken lock has no pair, the undeclared project none, the three unreadable locks are named
        expect(
            [broken, yarn, yarnUndeclared, pnpm, bunBinary].map((root) => pinnedPair(root)),
        ).toStrictEqual([
            null,
            { unread: 'yarn.lock', verdict: 'unread' },
            null,
            { unread: 'pnpm-lock.yaml', verdict: 'unread' },
            { unread: 'bun.lockb', verdict: 'unread' },
        ]);
    });

    test('reportPinnedPair — prints nothing without a pair, and the pair when it holds', () => {
        // Given - a project with no lock, and an agreeing one
        const none = projectWith({ 'package.json': '{}' });
        const ok = projectWith({
            'package-lock.json': npmLock({
                [`node_modules/${PROVIDER}`]: { version: '4.1.10' },
                'node_modules/vitest': { version: '4.1.10' },
            }),
        });

        // Then - nothing for the first; for the second the pair, aligned, and a verdict that fails nothing
        expect([
            printed(() => reportPinnedPair(none)),
            printed(() => reportPinnedPair(ok)),
        ]).toStrictEqual([
            { result: false, text: '' },
            {
                result: false,
                text: `\nPinned together\n\n  vitest                      4.1.10\n  ${PROVIDER}  4.1.10      ok\n\n`,
            },
        ]);
    });

    test('reportPinnedPair — prints the pair and its refusal when it is skewed, and answers that it failed', () => {
        // Given - a lock whose provider is a patch behind
        const skewed = projectWith({
            'package-lock.json': npmLock({
                [`node_modules/${PROVIDER}`]: { version: '4.1.9' },
                'node_modules/vitest': { version: '4.1.10' },
            }),
        });

        // When - it is reported
        const skew = printed(() => reportPinnedPair(skewed));

        // Then - the verdict failed, the pair stands aligned, and the refusal names both versions
        expect(skew.result).toBe(true);
        expect(skew.text).toContain(
            `  vitest                      4.1.10\n  ${PROVIDER}  4.1.9       skewed\n\n`,
        );
        expect(skew.text).toContain(`found: ${PROVIDER} 4.1.9 is not vitest 4.1.10`);
    });

    test('reportPinnedPair — says a lock the toolchain does not parse leaves the pin unchecked, and fails nothing', () => {
        // Given - a yarn lock beside a manifest declaring the provider
        const yarn = projectWith({ 'package.json': DECLARES, 'yarn.lock': '' });

        // Then - the lock is named as unread
        expect(printed(() => reportPinnedPair(yarn))).toStrictEqual({
            result: false,
            text: `\nPinned together\n\n  ${PROVIDER}  yarn.lock is not parsed here — the pin is unchecked\n\n`,
        });
    });
});
