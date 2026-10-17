import { dirname, join, relative, resolve } from 'node:path';

import type { Context, Pass } from '../../kit/checker/pass.js';
import { ARTIFACTS } from '../../kit/project/build-plan.js';
import { committedLines, trackedArtefacts } from './gitignore.tracked.js';
import { MISPLACED, misplacedTurboCache, turboJudged } from './gitignore.turbo.js';
import type { Judged } from './gitignore.turbo.js';
import { findWorkspaceRoot, nextConfigDeclaresExport } from './gitignore.workspace.js';
import type { Disk } from './gitignore.workspace.js';

type Line = { home: null | string; isNegation: boolean; pattern: string; text: string };

type Source = {
    isIgnored: boolean;
    label: string;
    lines: Line[];
    misplaced: Line[];
    negations: Line[];
    own: boolean;
    path: string;
};

// invariant: a build's product stays beside `src/` and is published from there.
const PRODUCT = 'dist';

const ARTEFACT_DIRECTORIES: ReadonlyMap<string, string> = new Map([
    ['.cache', '.artifacts/<tool>/'],
    ['.next', '.artifacts/next/'],
    ['.vite', '.artifacts/vite/'],
    ['bin', '.artifacts/go/'],
    ['build', '.artifacts/<tool>/'],
    ['coverage', '.artifacts/vitest/coverage/'],
    ['out', '.artifacts/next/'],
    ['playwright-report', '.artifacts/playwright/'],
    ['target', '.artifacts/cargo/'],
    ['test-results', '.artifacts/playwright/'],
]);

const ARTEFACT_EXTENSIONS: readonly (readonly [string, string])[] = [
    ['.tsbuildinfo', '.artifacts/tsc/'],
    ['.log', '.artifacts/logs/'],
];

// outside: paths a toolchain owns and cannot be told to move, or a framework expects at a fixed path.
const EXCEPTIONS: ReadonlySet<string> = new Set([
    '.build',
    '.expo',
    '.gradle',
    '.swiftpm',
    // outside: Turborepo's `.turbo/turbo-<task>.log` has no key, flag or variable to move it.
    '.turbo',
    '.vercel',
    'DerivedData',
    'Package.resolved',
    'android',
    'ios',
    'next-env.d.ts',
    'node_modules',
]);

// outside: Expo stamps a suffix onto it.
const EXCEPTION_PREFIXES = ['.metro-health-check'];

// outside: git's own reading: an anchored pattern in an ancestor's file never reaches a nested package.
function isAnchored(pattern: string): boolean {
    return pattern.replace(/\/+$/u, '').includes('/');
}

// invariant: `/out/`, `out/` and `**/out` all name `out`; `npm-debug.log*` reads as a log.
function lastNamedSegment(pattern: string): string {
    const segments = pattern
        .replace(/\/+$/u, '')
        .split('/')
        .filter((segment) => segment !== '' && segment !== '**');

    return (segments.at(-1) ?? '').replace(/\*$/u, '');
}

function artefactHome(
    pattern: string,
    { nextIsExportDestination }: { nextIsExportDestination: boolean },
): null | string {
    const name = lastNamedSegment(pattern);

    if (name === '' || name === PRODUCT || EXCEPTIONS.has(name)) {
        return null;
    }
    if (nextIsExportDestination && name === '.next') {
        return null;
    }
    if (EXCEPTION_PREFIXES.some((prefix) => name.startsWith(prefix))) {
        return null;
    }
    const directory = ARTEFACT_DIRECTORIES.get(name);
    if (directory !== undefined) {
        return directory;
    }
    for (const [extension, home] of ARTEFACT_EXTENSIONS) {
        if (name.endsWith(extension)) {
            return home;
        }
    }

    return null;
}

function readLines(disk: Disk, gitignorePath: string): Line[] {
    const nextIsExportDestination = nextConfigDeclaresExport(disk, dirname(gitignorePath));
    const text = (disk.read(gitignorePath) ?? '').split('\n');

    if (text.at(-1) === '') {
        text.pop();
    }

    return text.map((line) => {
        const pattern = line.trim();
        const isPattern = pattern !== '' && !pattern.startsWith('#');

        return {
            home:
                isPattern && !pattern.startsWith('!')
                    ? artefactHome(pattern, { nextIsExportDestination })
                    : null,
            isNegation: isPattern && pattern.startsWith('!'),
            pattern,
            text: line,
        };
    });
}

function readSource(
    disk: Disk,
    path: string,
    {
        own,
        reach = (): boolean => true,
        root,
    }: { own: boolean; reach?: (pattern: string) => boolean; root: string },
): Source {
    const lines = readLines(disk, path);

    return {
        isIgnored: lines.some(
            (line) =>
                !line.isNegation &&
                line.home === null &&
                lastNamedSegment(line.pattern) === ARTIFACTS &&
                reach(line.pattern),
        ),
        label: relative(resolve(root), path).split('\\').join('/'),
        lines,
        misplaced: lines.filter((line) => line.home !== null && reach(line.pattern)),
        negations: lines.filter((line) => line.isNegation),
        own,
        path,
    };
}

function rewrite(lines: readonly Line[]): string {
    const kept = lines.filter((line) => line.home === null);
    const isIgnored = kept.some(
        (line) => !line.isNegation && lastNamedSegment(line.pattern) === ARTIFACTS,
    );
    const body = kept.map((line) => line.text);

    if (!isIgnored) {
        while (body.length > 0 && body.at(-1)?.trim() === '') {
            body.pop();
        }
        body.push('', '# Build, test and lint artefacts (@jterrazz/typescript)', `${ARTIFACTS}/`);
    }

    return `${body.join('\n')}\n`;
}

function sourcesOf(context: Context, ancestorPath: null | string): Source[] {
    const { root } = context;
    const ownPath = join(root, '.gitignore');
    const sources: Source[] = [];
    if (context.exists(ownPath)) {
        sources.push(readSource(context, ownPath, { own: true, root }));
    }
    if (ancestorPath !== null && context.exists(ancestorPath)) {
        sources.push(
            readSource(context, ancestorPath, {
                own: false,
                reach: (pattern) => !isAnchored(pattern),
                root,
            }),
        );
    }

    return sources;
}

// invariant: only the package's own file: never created, and an ancestor is a different project's.
function fixed(sources: readonly Source[]): Judged {
    const own = sources.find((source) => source.own);
    if (own === undefined || (own.misplaced.length === 0 && own.isIgnored)) {
        return { lines: [], writes: [] };
    }

    return {
        lines: [
            '.gitignore rewritten:',
            ...own.misplaced.map((line) => `  - ${line.pattern}`),
            ...(own.isIgnored ? [] : [`  + ${ARTIFACTS}/`]),
            ...own.negations.map(
                (line) => `  · ${line.pattern}: a negation rescues a tracked file, kept`,
            ),
        ],
        writes: [{ path: own.path, text: rewrite(own.lines) }],
    };
}

function misplacedLines(sources: readonly Source[]): string[] {
    const isIgnored = sources.some((source) => source.isIgnored);
    const misplaced = sources.flatMap((source) =>
        source.misplaced.map((line) => ({ ...line, source })),
    );
    if (misplaced.length === 0 && isIgnored) {
        return [];
    }
    // invariant: a workspace root's file covers every member, so a missing `.artifacts/` belongs there.
    const target = sources.find((source) => !source.own) ?? sources[0];

    return [
        MISPLACED,
        ...misplaced.map(
            (line) =>
                `  ✗ ${line.source.label} names ${line.pattern}, whose home is ${line.home ?? ''}`,
        ),
        ...(isIgnored ? [] : [`  ✗ ${target?.label ?? ''} does not ignore ${ARTIFACTS}/; add it`]),
        ...sources
            .flatMap((source) => source.negations)
            .map((line) => `  · ${line.pattern}: a negation rescues a tracked file, left for you`),
        "Run 'typescript fix' to rewrite .gitignore.",
    ];
}

export const gitignore: Pass = Object.freeze({
    check(context) {
        const workspaceRoot = findWorkspaceRoot(context, context.root);
        const ancestorPath = workspaceRoot === null ? null : join(workspaceRoot, '.gitignore');
        if (context.has('--has-ancestor')) {
            return { failed: ancestorPath === null || !context.exists(ancestorPath) };
        }

        const sources = sourcesOf(context, ancestorPath);
        const turbo = misplacedTurboCache(context);
        if (sources.length === 0 && turbo === null) {
            return {};
        }
        const judged: Judged = context.fix
            ? fixed(sources)
            : { lines: misplacedLines(sources), writes: [] };
        const cache = turboJudged(turbo, context.fix, judged.lines.length > 0);
        const tracked = trackedArtefacts(context.root);
        const reported = judged.lines.length + cache.lines.length;

        return {
            failed: tracked.length > 0 || (!context.fix && reported > 0),
            lines: [...judged.lines, ...cache.lines, ...committedLines(tracked)],
            writes: [...judged.writes, ...cache.writes],
        };
    },
});
