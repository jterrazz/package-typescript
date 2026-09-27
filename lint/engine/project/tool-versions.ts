import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import process from 'node:process';

import { PACKAGE_ROOT } from './package-root.js';

const require = createRequire(import.meta.url);

type Manifest = {
    dependencies?: Record<string, string>;
    engines?: { node?: string };
    optionalDependencies?: Record<string, string>;
    version?: string;
};

export type ToolVersion = {
    installed: null | string;
    name: string;
    range: string;
    verdict: 'absent' | 'newer' | 'ok' | 'old';
};

// Versions are read off installed manifests: two of these tools answer `--version` in a shape of their own.
function manifestAt(path: string): Manifest {
    return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
}

const manifest = manifestAt(resolve(PACKAGE_ROOT, 'package.json'));

const PLATFORMS: Readonly<Record<string, string>> = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'win32',
};

const ARCHITECTURES: Readonly<Record<string, string>> = { arm: 'arm', arm64: 'arm64', x64: 'x64' };

function goCompilerPackage(): string {
    const os = PLATFORMS[process.platform] ?? 'linux';
    const arch = ARCHITECTURES[process.arch] ?? 'x64';

    return `@typescript/typescript-${os}-${arch}`;
}

// A package whose `exports` hides `./package.json` (knip) is invisible to `require`; the two
// directories after it are the ones the command's binary lookup walks.
function installedVersion(name: string): null | string {
    for (const at of [
        () => require.resolve(`${name}/package.json`),
        () => resolve(PACKAGE_ROOT, 'node_modules', name, 'package.json'),
        () => resolve(PACKAGE_ROOT, '../..', name, 'package.json'),
    ]) {
        try {
            return manifestAt(at()).version ?? null;
        } catch {
            continue;
        }
    }

    return null;
}

function versionParts(version: string): number[] {
    return (version.split(/[+-]/u)[0] ?? '')
        .split('.')
        .map((piece) => Number.parseInt(piece, 10) || 0);
}

function compareVersions(left: string, right: string): number {
    const [a, b] = [versionParts(left), versionParts(right)];
    for (let index = 0; index < 3; index += 1) {
        if ((a[index] ?? 0) !== (b[index] ?? 0)) {
            return (a[index] ?? 0) - (b[index] ?? 0);
        }
    }

    return 0;
}

// As npm reads it: below 1.0.0 a caret allows the patch line only.
function boundsOf(range: string): { ceiling: null | string; exact?: boolean; floor: string } {
    const floor = range.replace(/^[\^>=~ ]+/u, '');
    const [major = 0, minor = 0] = versionParts(floor);

    if (range.startsWith('^')) {
        return { ceiling: major === 0 ? `0.${minor + 1}.0` : `${major + 1}.0.0`, floor };
    }
    if (range.startsWith('>=') || range.startsWith('>')) {
        return { ceiling: null, floor };
    }
    if (range.startsWith('~')) {
        return { ceiling: `${major}.${minor + 1}.0`, floor };
    }

    return { ceiling: floor, exact: true, floor };
}

function verdictOf(installed: null | string, range: string): ToolVersion['verdict'] {
    if (installed === null) {
        return 'absent';
    }

    const { ceiling, exact, floor } = boundsOf(range);
    if (compareVersions(installed, floor) < 0) {
        return 'old';
    }
    if (exact === true) {
        return compareVersions(installed, floor) === 0 ? 'ok' : 'newer';
    }

    return ceiling !== null && compareVersions(installed, ceiling) >= 0 ? 'newer' : 'ok';
}

const declared: Record<string, string> = {
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
};

export function toolVersions(): ToolVersion[] {
    const rows: [string, null | string, string][] = [
        ['node', process.version.replace(/^v/u, ''), manifest.engines?.node ?? '*'],
        ['tsc (Go)', installedVersion(goCompilerPackage()), declared[goCompilerPackage()] ?? '*'],
        ['typescript', installedVersion('typescript'), declared.typescript ?? '*'],
        ['oxlint', installedVersion('oxlint'), declared.oxlint ?? '*'],
        ['oxfmt', installedVersion('oxfmt'), declared.oxfmt ?? '*'],
        [
            'oxlint-tsgolint',
            installedVersion('oxlint-tsgolint'),
            declared['oxlint-tsgolint'] ?? '*',
        ],
        ['knip', installedVersion('knip'), declared.knip ?? '*'],
    ];

    return rows.map(([name, installed, range]) => ({
        installed,
        name,
        range,
        verdict: verdictOf(installed, range),
    }));
}
