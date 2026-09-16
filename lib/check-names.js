#!/usr/bin/env node

/**
 * What a project's own tree calls its parts.
 *
 * Two rosters, both closed, both here and nowhere else. A **grab-bag** name
 * says nothing about what it holds, so it holds whatever nobody placed:
 * `utils.ts` is what a folder called `utils/` grows out of, and the folder is
 * what a missing subject grows out of. A **shortcut** says it in half — each
 * one the short form of a word the tree spells out somewhere else, so two
 * spellings of one idea end up sitting side by side.
 *
 * Usage: node check-names.js [root] [--ignore-pattern <glob>]…
 *
 * One line per violation, `<rule>  <path>  <message>`. Exit code: 0 when every
 * name claims a subject, 1 otherwise. No `--fix`: renaming a file is a move,
 * and choosing the name it moves to is the work the rule is asking for.
 */

import { resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { ignorePatternsOf, trackedFiles } from './tracked-files.js';

/** Names that say nothing: a folder or a file called one of these holds whatever nobody placed. */
const GRAB_BAG = new Set([
    'base',
    'common',
    'core',
    'helpers',
    'lib',
    'misc',
    'shared',
    'stuff',
    'tools',
    'utils',
]);

/**
 * Names that say it in half — each the short form of a word the tree writes out
 * somewhere. The `_` marker does not excuse one: it states a position, not
 * whether the name is whole. A name is read segment by segment, split on the
 * hyphen, so `explore-repo` is caught.
 */
const SHORTCUTS = new Set([
    'auth',
    'cfg',
    'impl',
    'infra',
    'k8s',
    'pkg',
    'repo',
    'repos',
    'svc',
    'tmp',
]);

/**
 * The roots the rule sweeps — where a project keeps what it wrote. Each root's
 * OWN name is the toolchain's vocabulary, not the project's choice, so it is
 * never judged: `lib/` is on both this list and the grab-bag roster, and only
 * what a project put INSIDE it is the project's to name.
 */
const SWEPT = new Set(['apps', 'bin', 'lib', 'packages', 'specs', 'src', 'tests']);

/**
 * A Next.js route segment is a URL: what a directory below `app/` is called is
 * the address the product serves, not a name the tree chose. The router root
 * itself is judged like any directory; what it contains is not.
 */
const ROUTER_ROOT = 'app';

/** A `_` opens a row — a fixture, a golden, a template — and a row is not a subject. */
const isOfTheRow = (name) => name.startsWith('_');

/** A directory claims its own segment. */
const isGrabBag = (name) => !isOfTheRow(name) && GRAB_BAG.has(name.toLowerCase());

/** A name carries a truncation when any hyphen-separated segment of it is one. */
const isShortcut = (name) =>
    name
        .toLowerCase()
        .split('-')
        .some((segment) => SHORTCUTS.has(segment));

/** A file claims what stands before its first dot: `utils.ts` and `utils.test.ts` both claim `utils`. */
const stemOf = (name) => name.split('.')[0] ?? '';

/**
 * Every name a set of paths puts on the tree, each mapped to the path that
 * carries it: every directory below a swept root that is not a route, and
 * every file's stem.
 */
function namesOf(files) {
    const named = new Map();

    for (const file of files) {
        const segments = file.split('/');
        if (!SWEPT.has(segments[0]) || segments.length < 2) {
            continue;
        }

        /* From the second segment on: the root's own name is not the project's,
         * and below a router root a directory is a route. */
        const routerRoot = segments.indexOf(ROUTER_ROOT, 1);
        const lastJudged = routerRoot === -1 ? segments.length - 1 : routerRoot + 1;
        for (let index = 1; index < Math.min(lastJudged, segments.length - 1); index += 1) {
            const path = segments.slice(0, index + 1).join('/');
            named.set(path, segments[index]);
        }
        named.set(file, stemOf(segments.at(-1)));
    }

    return [...named].toSorted(([left], [right]) => (left < right ? -1 : 1));
}

const root = resolve(argv.slice(2).find((argument) => !argument.startsWith('--')) ?? '.');
const named = namesOf(trackedFiles(root, { ignorePatterns: ignorePatternsOf(argv) }));

let failed = false;
for (const [path, name] of named) {
    if (isGrabBag(name)) {
        stdout.write(
            `names-grab-bag  ${path}  \`${name}\` names no subject — it holds whatever nobody placed\n`,
        );
        failed = true;
    }
    if (isShortcut(name)) {
        stdout.write(
            `names-shortcut  ${path}  \`${name}\` is a word written in half — spell it whole\n`,
        );
        failed = true;
    }
}

exit(failed ? 1 : 0);
