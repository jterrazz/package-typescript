// invariant: the ground a test stands on is its scenario's, judged where the scenario runs it, never here.
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { join, matchesGlob } from 'node:path';
import { exit, stderr } from 'node:process';

import { refusal } from '../catalogue/lesson.js';
import { ARTIFACTS } from './build-plan.js';
import { listNotIgnored } from './git-tree.js';
import { git } from './git.js';
import { isGroundFolder, TESTS_FOLDER } from './ground.js';

export const UNSWEPT: ReadonlySet<string> = new Set([
    ARTIFACTS,
    '.git',
    '.next',
    '.turbo',
    '.vite',
    'coverage',
    'dist',
    'node_modules',
]);

const BINARY = /\.(?:avif|bin|gif|ico|jpeg|jpg|lock|mp4|pdf|png|svg|ttf|webp|woff2?|zip)$/iu;

function gitSweep(root: string): null | string[] {
    const listed = listNotIgnored(root);

    return listed === null
        ? null
        : [...new Set(listed)].filter(
              (path) =>
                  path !== '' &&
                  lstatSync(join(root, path), { throwIfNoEntry: false }) !== undefined,
          );
}

// outside: `dist/` in .gitignore matches the directory form only, so each path is asked in both spellings; outside a git tree nothing is ignored.
export function ignoredPaths(root: string, paths: readonly string[]): ReadonlySet<string> {
    // Stryker disable next-line ConditionalExpression,BlockStatement: git asked of no path answers none; the guard spares the process
    if (paths.length === 0) {
        return new Set();
    }
    const answer = git(
        root,
        ['check-ignore', '--no-index', '--stdin'],
        paths.flatMap((path) => [path, `${path}/`]).join('\n'),
    );
    const ignored = new Set(answer?.split('\n'));

    return new Set(paths.filter((path) => ignored.has(path) || ignored.has(`${path}/`)));
}

export const isGitIgnored = (root: string, target: string): boolean =>
    ignoredPaths(root, [target]).has(target);

// invariant: outside a git tree there is nothing committed.
export const trackedFiles = (root: string): string[] =>
    (git(root, ['ls-files', '-z']) ?? '').split('\0').filter((path) => path !== '');

function walkSweep(root: string): string[] {
    const found: string[] = [];

    function walk(relativePath: string): void {
        let entries: Dirent[];
        try {
            entries = readdirSync(join(root, relativePath), { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            // Stryker disable next-line ConditionalExpression,BlockStatement: a build folder walked is filtered out after; skipping it spares the walk alone
            if (UNSWEPT.has(entry.name)) {
                continue;
            }
            const child = relativePath === '' ? entry.name : `${relativePath}/${entry.name}`;
            if (entry.isDirectory()) {
                walk(child);
            } else if (entry.isFile()) {
                found.push(child);
            }
        }
    }

    walk('');

    return found;
}

function holdsSomething(root: string): boolean {
    try {
        return readdirSync(root).some((name) => !UNSWEPT.has(name));
    } catch {
        return false;
    }
}

// Stryker disable next-line EqualityOperator: a sweep lists each path once, so no two compare equal
const byPath = (left: string, right: string): number => (left < right ? -1 : 1);

// invariant: ground is a test's own under a specs tree or a module's tests folder; anywhere else it is a folder like any, which the Names pass judges.
function isGround(path: string): boolean {
    const folders = path.split('/').slice(0, -1);

    return folders.some(
        (folder, at) =>
            isGroundFolder(folder) &&
            folders.slice(0, at).some((above) => above === 'specs' || above === TESTS_FOLDER),
    );
}

export class EmptySweepError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EmptySweepError';
    }
}

export function projectFiles(
    root = '.',
    // Stryker disable next-line ArrayDeclaration: a pattern no path matches ignores what no pattern does
    { ignorePatterns = [] }: { ignorePatterns?: readonly string[] } = {},
): string[] {
    const listed = gitSweep(root);
    const swept = listed ?? walkSweep(root);

    if (swept.length === 0) {
        if (holdsSomething(root)) {
            throw new EmptySweepError(
                refusal(
                    listed === null
                        ? {
                              fix: "add the project's files, then run again",
                              found: `nothing to read under ${root}: it holds folders and no file`,
                              read: 'docs/reference/quality-checks.md#an-unreadable-tree',
                              why: 'a sweep that reads nothing would turn every gate above it green',
                          }
                        : {
                              fix: "take the project's files out of .gitignore, then run again",
                              found: `nothing to read under ${root}: git ignores every file it holds`,
                              read: 'docs/reference/quality-checks.md#an-unreadable-tree',
                              why: 'a sweep that reads nothing would turn every gate above it green',
                          },
                ),
            );
        }

        return [];
    }

    return swept
        .filter((path) => !path.split('/').some((segment) => UNSWEPT.has(segment)))
        .filter((path) => !isGround(path))
        .filter((path) => !ignorePatterns.some((pattern) => matchesGlob(path, pattern)))
        .toSorted(byPath);
}

export function orRefused<T>(read: () => T): T {
    try {
        return read();
    } catch (error) {
        if (!(error instanceof EmptySweepError)) {
            throw error;
        }
        stderr.write(`${error.message}\n`);

        return exit(1);
    }
}

// invariant: a symlink's content belongs to its target, judged there once instead of twice.
export function readText(root: string, path: string): null | string {
    if (BINARY.test(path)) {
        return null;
    }

    try {
        const stats = lstatSync(join(root, path));
        if (stats.isSymbolicLink() || stats.size > 1_000_000) {
            return null;
        }
        const text = readFileSync(join(root, path), 'utf8');

        return text.includes('\0') ? null : text;
    } catch {
        return null;
    }
}

export function ignorePatternsOf(argv: readonly string[]): string[] {
    const patterns: string[] = [];
    for (const [index, argument] of argv.entries()) {
        const pattern = argv[index + 1];
        if (argument === '--ignore-pattern' && pattern !== undefined) {
            patterns.push(pattern);
        }
    }

    return patterns;
}

export const PRUNED: ReadonlySet<string> = new Set(['.git', 'dist', 'node_modules']);

export function filesUnder(dir: string): string[] {
    if (!existsSync(dir)) {
        return [];
    }

    return readdirSync(dir, { recursive: true })
        .map(String)
        .filter((path) => statSync(join(dir, path)).isFile())
        .toSorted();
}
