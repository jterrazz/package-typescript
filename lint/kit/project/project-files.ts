// The ground a test stands on is its scenario's, judged where the scenario runs it, never here.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { join, matchesGlob } from 'node:path';
import { exit, stderr } from 'node:process';

import { refusal } from '../catalogue/lesson.js';
import { isGroundFolder } from './ground.js';

export const UNSWEPT = new Set([
    '.artifacts',
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
    const listed = (flags: string[]): string[] =>
        execFileSync('git', ['ls-files', ...flags, '-z'], {
            cwd: root,
            encoding: 'utf8',
            maxBuffer: 256 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'ignore'],
        })
            .split('\0')
            .filter((path) => path !== '');

    try {
        const deleted = new Set(listed(['--deleted']));

        return [...new Set(listed(['--cached', '--others', '--exclude-standard']))].filter(
            (path) => !deleted.has(path),
        );
    } catch {
        return null;
    }
}

// `dist/` in .gitignore matches the directory form only, so each path is asked in both spellings; outside a git tree nothing is ignored.
export function ignoredPaths(root: string, paths: readonly string[]): ReadonlySet<string> {
    if (paths.length === 0) {
        return new Set();
    }
    const answer = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
        cwd: root,
        encoding: 'utf8',
        input: paths.flatMap((path) => [path, `${path}/`]).join('\n'),
        stdio: ['pipe', 'pipe', 'ignore'],
    });
    const ignored = new Set((answer.stdout ?? '').split('\n').filter((line) => line !== ''));

    return new Set(paths.filter((path) => ignored.has(path) || ignored.has(`${path}/`)));
}

export const isGitIgnored = (root: string, target: string): boolean =>
    ignoredPaths(root, [target]).has(target);

// Outside a git tree there is nothing committed.
export function trackedFiles(root: string): string[] {
    try {
        return execFileSync('git', ['ls-files', '-z'], {
            cwd: root,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        })
            .split('\0')
            .filter((path) => path !== '');
    } catch {
        return [];
    }
}

function walkSweep(root: string): string[] {
    const found: string[] = [];

    function walk(relativePath: string): void {
        let entries: Dirent[];
        try {
            entries = readdirSync(join(root, relativePath), { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries.toSorted((a, b) => (a.name < b.name ? -1 : 1))) {
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

function isGround(path: string): boolean {
    return path.split('/').slice(0, -1).some(isGroundFolder);
}

export class EmptySweepError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EmptySweepError';
    }
}

export function projectFiles(
    root = '.',
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
                              read: 'docs/07-quality-checks.md#an-unreadable-tree',
                              why: 'a sweep that reads nothing would turn every gate above it green',
                          }
                        : {
                              fix: "take the project's files out of .gitignore, then run again",
                              found: `nothing to read under ${root}: git ignores every file it holds`,
                              read: 'docs/07-quality-checks.md#an-unreadable-tree',
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
        .toSorted((left, right) => (left < right ? -1 : 1));
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

// A symlink's content belongs to its target, judged there once instead of twice.
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
