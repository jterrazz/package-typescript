import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { objectOf, parsedObject } from '../../../lint/kit/project/json.js';
import { print } from '../check/report/terminal.js';
import { declaredAnywhere } from './declared.js';

type Read = (text: string, name: string) => ReadonlySet<string>;

type Pair =
    | { provider: string[]; runner: string[]; verdict: 'ok' | 'skewed' }
    | { unread: string; verdict: 'unread' };

// outside: `@vitest/browser-playwright` ships from vitest's repository with vitest's version: a patch
// apart loads a second copy of vitest's internals and fails in the browser.
const PINNED_PAIR: { readonly provider: string; readonly runner: string } = Object.freeze({
    provider: '@vitest/browser-playwright',
    runner: 'vitest',
});

export function npmVersions(text: string, name: string): ReadonlySet<string> {
    const suffix = `node_modules/${name}`;
    const versions = new Set<string>();
    const packages = objectOf(parsedObject(text).packages);

    for (const [path, entry] of Object.entries(packages ?? {})) {
        const { version } = objectOf(entry);
        if ((path === suffix || path.endsWith(`/${suffix}`)) && typeof version === 'string') {
            versions.add(version);
        }
    }

    return versions;
}

// outside: `bun.lock` is JSON with trailing commas.
export function bunVersions(text: string, name: string): ReadonlySet<string> {
    const versions = new Set<string>();
    const packages = objectOf(
        parsedObject(text.replaceAll(/,(?<trailing>\s*[\]}])/gu, '$<trailing>')).packages,
    );

    for (const [key, entry] of Object.entries(packages ?? {})) {
        const descriptor: unknown = Array.isArray(entry) ? entry[0] : entry;
        if ((key === name || key.endsWith(`/${name}`)) && typeof descriptor === 'string') {
            versions.add(descriptor.slice(descriptor.lastIndexOf('@') + 1));
        }
    }

    return versions;
}

const READ_LOCKFILES: readonly (readonly [string, Read])[] = [
    ['package-lock.json', npmVersions],
    ['npm-shrinkwrap.json', npmVersions],
    ['bun.lock', bunVersions],
];

const UNREAD_LOCKFILES = ['bun.lockb', 'pnpm-lock.yaml', 'yarn.lock'];

// Stryker disable next-line EqualityOperator: a set holds no version twice, so the comparator is never asked to rank a version against itself
const ascending = (left: string, right: string): number => (left < right ? -1 : 1);

function lockedVersions(path: string, read: Read, name: string): null | string[] {
    try {
        return [...read(readFileSync(path, 'utf8'), name)].toSorted(ascending);
    } catch {
        return null;
    }
}

export function pinnedPair(root: string): null | Pair {
    const readable = READ_LOCKFILES.map(([name, read]) => [join(root, name), read] as const).find(
        ([path]) => existsSync(path),
    );

    if (readable === undefined) {
        const unread = UNREAD_LOCKFILES.find((name) => existsSync(join(root, name)));
        if (unread !== undefined && declaredAnywhere(root, PINNED_PAIR.provider)) {
            return { unread, verdict: 'unread' };
        }

        return null;
    }

    const provider = lockedVersions(readable[0], readable[1], PINNED_PAIR.provider);
    if (provider === null || provider.length === 0) {
        return null;
    }

    const runner = lockedVersions(readable[0], readable[1], PINNED_PAIR.runner) ?? [];
    const matched = runner.length === 1 && provider.length === 1 && runner[0] === provider[0];

    return { provider, runner, verdict: matched ? 'ok' : 'skewed' };
}

export function versionColumn(versions: readonly string[]): string {
    return versions.length === 0 ? '—' : versions.join(', ');
}

export function reportPinnedPair(root: string): boolean {
    const pair = pinnedPair(root);
    if (pair === null) {
        return false;
    }

    print('\nPinned together\n\n');

    if (pair.verdict === 'unread') {
        print(
            `  ${PINNED_PAIR.provider.padEnd(28)}${pair.unread} is not parsed here — the pin is unchecked\n\n`,
        );
        return false;
    }

    print(`  ${PINNED_PAIR.runner.padEnd(28)}${versionColumn(pair.runner)}\n`);
    print(
        `  ${PINNED_PAIR.provider.padEnd(28)}${versionColumn(pair.provider).padEnd(12)}${pair.verdict}\n\n`,
    );

    if (pair.verdict === 'skewed') {
        print(
            `${refusal({
                fix: 'pin both to the same version',
                found: `${PINNED_PAIR.provider} ${versionColumn(pair.provider)} is not ${PINNED_PAIR.runner} ${versionColumn(pair.runner)}`,
                read: 'docs/guides/adopt-a-stricter-release.md#the-provider-pinned-to-its-runner',
                why: `${PINNED_PAIR.provider} is versioned with ${PINNED_PAIR.runner} and must equal it exactly: a patch apart loads a second copy of its internals`,
            })}\n`,
        );
    }

    return pair.verdict === 'skewed';
}
