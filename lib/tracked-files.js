/**
 * The files a project would carry into a commit — the one sweep every
 * tree-reading gate starts from.
 *
 * `git ls-files --cached --others --exclude-standard` is the answer wherever
 * there is a git tree: it names what is tracked AND what the next `git add`
 * would track, so a file fails a gate before it is committed, not after. A
 * directory git knows nothing about — a fixture the spec runner copied, a tree
 * nobody has `git init`ed — is walked instead, because a gate that goes silent
 * outside git is a gate that passes on everything.
 *
 * The sweep REFUSES an answer that is empty while the tree is not. A read that
 * silently sees nothing turns every rule above it vacuously green, which is the
 * one failure mode a gate must never have — and a genuinely bare directory,
 * which the sandboxes of `specs/cli/` build, is told apart from it by looking.
 *
 * It also refuses to answer for the GROUND a spec stands on. `_fixtures/`,
 * `_expected/`, `_stubs/` and `_binary/` hold a tree deliberately broken, a
 * golden held byte for byte, a fake system and a build — each belonging to the
 * scenario that mounts it, not to the project carrying it. A gate judges that
 * tree where the scenario runs it, on its own ground, and never twice.
 */

import { execFileSync } from 'node:child_process';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, matchesGlob } from 'node:path';

/** Never source, never prose: what no gate of this toolchain has a question about. */
const UNSWEPT = new Set([
    '.artifacts',
    '.git',
    '.next',
    '.turbo',
    '.vite',
    'coverage',
    'dist',
    'node_modules',
]);

/** Extensions whose bytes are not text — reading them for patterns is noise. */
const BINARY = /\.(?:avif|bin|gif|ico|jpeg|jpg|lock|mp4|pdf|png|svg|ttf|webp|woff2?|zip)$/iu;

/** Every path git carries or would carry, or null when there is no git tree here. */
function gitSweep(root) {
    try {
        return execFileSync(
            'git',
            ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
            { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
        )
            .split('\0')
            .filter((path) => path !== '');
    } catch {
        return null;
    }
}

/** The same listing, derived from the filesystem, for a tree git does not know. */
function walkSweep(root) {
    const found = [];

    function walk(relativePath) {
        let entries;
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

/** Whether anything the gates would ever read sits at the root at all. */
function holdsSomething(root) {
    try {
        return readdirSync(root).some((name) => !UNSWEPT.has(name));
    } catch {
        return false;
    }
}

/**
 * The ground a spec stands on, by the four names `@jterrazz/test` 14 gives it.
 * `_common/` is deliberately absent: it is the project's own shared code, and
 * the marker there says "of the row", not "not mine".
 */
const GROUND = new Set(['_binary', '_expected', '_fixtures', '_stubs']);

/** Whether a path lies under the ground a scenario mounts rather than in the project. */
const isGround = (path) => path.split('/').some((segment) => GROUND.has(segment));

/**
 * The sweep, filtered by what the run was told to overlook. `ignorePatterns`
 * carries the `--ignore-pattern` globs `check` received, so one flag answers
 * for the linter and for every gate that reads the same tree.
 */
export function trackedFiles(root = '.', { ignorePatterns = [] } = {}) {
    const swept = gitSweep(root) ?? walkSweep(root);

    if (swept.length === 0) {
        if (holdsSomething(root)) {
            throw new Error(
                `nothing to read under ${root} — a gate sweeping no file passes on every file`,
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

/**
 * A tracked file's text, or null when there is no text to read: bytes, a file
 * too large to be prose or source, one that is gone, or a SYMLINK — whose
 * content belongs to its target, and is judged there once instead of twice.
 */
export function readText(root, path) {
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

/** The `--ignore-pattern` globs of an argument list, in the order they arrived. */
export function ignorePatternsOf(argv) {
    const patterns = [];
    for (const [index, argument] of argv.entries()) {
        if (argument === '--ignore-pattern' && argv[index + 1] !== undefined) {
            patterns.push(argv[index + 1]);
        }
    }

    return patterns;
}
