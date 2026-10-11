import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OxlintConfig } from 'oxlint';

import { readSettings } from '../../../lint/index.rules.js';
import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { conventionsOf } from '../../../lint/kit/project/build-plan.js';
import { objectOf, parsedObject } from '../../../lint/kit/project/json.js';
import { SETTINGS_FILE } from '../../../lint/kit/project/jterrazz-config.js';
import { originLines } from '../../../lint/kit/project/origins.js';
import type { Derived } from '../../../lint/kit/project/origins.js';
import type { Resolved } from '../../../lint/kit/project/preset.js';
import { toolVersions } from '../../../lint/kit/project/tool-versions.js';
import { workspaceMembers } from '../../../lint/kit/project/workspace-members.js';
import { badge, print } from '../check/report/terminal.js';
import { chromiumBuilds } from './browsers.js';

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

// outside: `bun.lock` is JSON with trailing commas.
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

// outside: in a monorepo the member running browser mode declares the provider, not the root.
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

function pinnedPair(root: string): null | Pair {
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

// invariant: a project that declares Playwright and resolves it owes the machine the Chromium build that Playwright launches; a revision the machine lacks fails every browser project at launch, and `doctor` is where it reads before a run.
function reportBrowsers(root: string): boolean {
    const declared = ['playwright', 'playwright-core', '@vitest/browser-playwright'].some((name) =>
        declaredAnywhere(root, name),
    );
    const builds = declared ? chromiumBuilds(root) : undefined;
    if (builds === undefined || builds.length === 0) {
        return false;
    }
    print('\nBrowsers\n\n');
    for (const { installed, name, revision } of builds) {
        print(
            `  ${name.padEnd(28)}r${revision.padEnd(10)}${installed ? 'installed' : 'missing'}\n`,
        );
    }
    print('\n');
    const missing = builds.filter(({ installed }) => !installed);
    if (missing.length > 0) {
        print(
            `${refusal({
                fix: 'run `npx playwright install chromium` in the project, then `typescript doctor` again',
                found: `the machine lacks ${missing.map(({ name, revision }) => `${name} r${revision}`).join(', ')}, which the Playwright this project resolves launches`,
                read: 'docs/guides/adopt-a-stricter-release.md#the-browser-build-on-the-machine',
                why: 'a browser project fails at launch on a revision the machine does not hold, and several Playwright revisions on one machine each need their own build',
            })}\n`,
        );
    }

    return missing.length > 0;
}

function derivedOf(unit: string, resolved: Resolved): Derived {
    const { dev, entries } = conventionsOf(unit).settings;
    const build = {
        ...(Object.keys(entries).length === 0 ? {} : { entries }),
        ...(Object.keys(dev).length === 0 ? {} : { dev }),
    };

    return {
        ...(Object.keys(build).length === 0 ? {} : { build }),
        ...Object.fromEntries(
            resolved.presets.flatMap(({ derive, name }) =>
                derive === undefined ? [] : [[name, derive(unit)]],
            ),
        ),
    };
}

const NODE_MODULES = '/node_modules/';

// invariant: a plugin the rulebook resolves from its own install is named inside the package that ships it, the same on every machine.
async function shownProfile({ declaration }: Resolved): Promise<OxlintConfig> {
    // hazard: the rulebook resolves its JS plugins as it loads, so it loads when the doctor prints it, never as the command line starts every other command.
    const { rulebookProfileOf } = await import('../../../lint/index.rulebook.js');
    const rulebook = rulebookProfileOf(declaration?.platform ?? 'node');

    return {
        ...rulebook,
        jsPlugins: (rulebook.jsPlugins ?? []).map((plugin) =>
            // Stryker disable next-line ConditionalExpression: every JS plugin the rulebook names is a path
            typeof plugin === 'string' && plugin.includes(NODE_MODULES)
                ? plugin.slice(plugin.lastIndexOf(NODE_MODULES) + NODE_MODULES.length)
                : plugin,
        ),
    };
}

async function reportConfig(root: string): Promise<void> {
    for (const unit of ['.', ...workspaceMembers(root)]) {
        const { problem, resolved } = await readSettings(join(root, unit));
        const file = unit === '.' ? SETTINGS_FILE : `${unit}/${SETTINGS_FILE}`;
        print(`\nResolved ${file}\n\n`);
        if (problem !== null) {
            print(`  ${file} ${problem}\n`);
            continue;
        }
        const lines = originLines(resolved, {
            derived: derivedOf(join(root, unit), resolved),
            holds: (folder) => existsSync(join(root, unit, folder)),
            rulebook: await shownProfile(resolved),
        });
        const width = Math.max(...lines.map(({ origin }) => origin.length)) + 2;
        for (const { origin, setting } of lines) {
            print(`  ${origin.padEnd(width)}${setting}\n`);
        }
    }
}

export async function doctor(root: string): Promise<number> {
    print(`${badge('TYPESCRIPT')} Checking the toolchain...\n\n`);
    const rows = toolVersions();
    const failed = rows.some(({ verdict }) => verdict === 'old' || verdict === 'absent');
    const warned = rows.some(({ verdict }) => verdict === 'newer');

    print('Toolchain versions\n\n');

    const nameWidth = Math.max(...rows.map(({ name }) => name.length)) + 2;
    for (const { installed, name, range, verdict } of rows) {
        print(
            `  ${name.padEnd(nameWidth)}${(installed ?? '—').padEnd(12)}${range.padEnd(12)}${verdict}\n`,
        );
    }

    // Stryker disable next-line StringLiteral,CallExpression: a blank line between the table and its verdict, which no reader parses
    print('\n');

    if (failed) {
        print(
            `${refusal({
                fix: 'install what this release declares, then run `typescript doctor` again',
                found: 'a tool is older than its range, or not installed — its row reads `old` or `absent`',
                read: 'docs/guides/adopt-a-stricter-release.md#the-two-gestures',
                why: 'a gate running an older tool enforces an older rulebook without saying so',
            })}\n`,
        );
    } else if (warned) {
        print('A tool ahead of its range may be fine; the toolchain does not get to decide.\n');
    } else {
        print('Every tool is in range.\n');
    }

    const skewed = reportPinnedPair(root);
    const missing = reportBrowsers(root);
    await reportConfig(root);

    return failed || skewed || missing ? 1 : 0;
}
