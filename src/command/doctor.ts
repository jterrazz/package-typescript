import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stdout } from 'node:process';

import { objectOf, parsedObject } from '../../lint/engine/project/json.js';
import { toolVersions } from '../../lint/engine/project/tool-versions.js';
import { workspaceMembers } from '../../lint/engine/project/workspace-members.js';

// `@vitest/browser-playwright` ships from vitest's repository with vitest's version: a patch
// apart loads a second copy of vitest's internals and fails in the browser.
type Read = (text: string, name: string) => ReadonlySet<string>;

type Pair =
    | { provider: string[]; runner: string[]; verdict: 'ok' | 'skewed' }
    | { unread: string; verdict: 'unread' };

export const PINNED_PAIR: { readonly provider: string; readonly runner: string } = Object.freeze({
    provider: '@vitest/browser-playwright',
    runner: 'vitest',
});

function npmVersions(text: string, name: string): ReadonlySet<string> {
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

// `bun.lock` is JSON with trailing commas.
function bunVersions(text: string, name: string): ReadonlySet<string> {
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

function lockedVersions(path: string, read: Read, name: string): null | string[] {
    try {
        return [...read(readFileSync(path, 'utf8'), name)].toSorted((left, right) =>
            left < right ? -1 : 1,
        );
    } catch {
        return null;
    }
}

// In a monorepo the member running browser mode declares the provider, not the root.
function declaredAnywhere(root: string, name: string): boolean {
    return ['.', ...workspaceMembers(root)].some((member) => {
        try {
            const pkg = parsedObject(readFileSync(join(root, member, 'package.json'), 'utf8'));
            return (
                {
                    ...objectOf(pkg.dependencies),
                    ...objectOf(pkg.devDependencies),
                    ...objectOf(pkg.peerDependencies),
                }[name] !== undefined
            );
        } catch {
            return false;
        }
    });
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

function versionColumn(versions: readonly string[]): string {
    return versions.length === 0 ? '—' : versions.join(', ');
}

function reportPinnedPair(root: string): boolean {
    const pair = pinnedPair(root);
    if (pair === null) {
        return false;
    }

    stdout.write('\nPinned together\n\n');

    if (pair.verdict === 'unread') {
        stdout.write(
            `  ${PINNED_PAIR.provider.padEnd(28)}${pair.unread} is not parsed here — the pin is unchecked\n\n`,
        );
        return false;
    }

    stdout.write(`  ${PINNED_PAIR.runner.padEnd(28)}${versionColumn(pair.runner)}\n`);
    stdout.write(
        `  ${PINNED_PAIR.provider.padEnd(28)}${versionColumn(pair.provider).padEnd(12)}${pair.verdict}\n\n`,
    );

    if (pair.verdict === 'skewed') {
        stdout.write(
            `${PINNED_PAIR.provider} is versioned with ${PINNED_PAIR.runner} and must equal it exactly — pin both to the same version.\n`,
        );
    }

    return pair.verdict === 'skewed';
}

export function doctor(root: string): number {
    const rows = toolVersions();
    const failed = rows.some(({ verdict }) => verdict === 'old' || verdict === 'absent');
    const warned = rows.some(({ verdict }) => verdict === 'newer');

    stdout.write('Toolchain versions\n\n');

    for (const { installed, name, range, verdict } of rows) {
        stdout.write(
            `  ${name.padEnd(16)}${(installed ?? '—').padEnd(12)}${range.padEnd(12)}${verdict}\n`,
        );
    }

    stdout.write('\n');

    if (failed) {
        stdout.write('A tool older than its range enforces an older rulebook without saying so.\n');
    } else if (warned) {
        stdout.write(
            'A tool ahead of its range may be fine; the toolchain does not get to decide.\n',
        );
    } else {
        stdout.write('Every tool is in range.\n');
    }

    const skewed = reportPinnedPair(root);

    return failed || skewed ? 1 : 0;
}
