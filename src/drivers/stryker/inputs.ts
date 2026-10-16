import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

import { ARTIFACTS } from '../../../lint/kit/project/build-plan.js';
import { listNotIgnored } from '../../../lint/kit/project/git-tree.js';
import { GROUND_FOLDERS, SETUP_FOLDER } from '../../../lint/kit/project/ground.js';
import { objectOf, stringOf } from '../../../lint/kit/project/json.js';

/** Every file a run's tests may read, by its hash; the install stands for the toolchain git does not list. */
export type Inputs = Readonly<Record<string, string>>;

const INSTALL = 'node_modules/.package-lock.json';

const hashOf = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');

/** The hash of every file git lists in the project, ignored files and the output of runs aside, and of the install; `undefined` where git cannot list the tree, so no change could be told. */
export function inputsOf(project: string): Record<string, string> | undefined {
    // outside: the sweep that lists a project's files leaves a test's ground to its scenario, so the tree is asked of git directly.
    const listed = listNotIgnored(project);
    if (listed === null) {
        return undefined;
    }
    const inputs: Record<string, string> = {};
    for (const path of listed) {
        const file = join(project, path);
        if (
            !path.startsWith(`${ARTIFACTS}/`) &&
            statSync(file, { throwIfNoEntry: false })?.isFile() === true
        ) {
            inputs[path] = hashOf(readFileSync(file));
        }
    }
    const install = join(project, INSTALL);
    inputs[INSTALL] = existsSync(install) ? hashOf(readFileSync(install)) : 'absent';

    return inputs;
}

/** The paths whose bytes differ between two records of the inputs, a file added or removed included. */
export function changedBetween(before: Inputs, after: Inputs): string[] {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
        (path) => before[path] !== after[path],
    );
}

/** What a file is to the tests of a run: a test, the ground of the folder above it, a module code loads, or what every test stands on. */
export type Role =
    | { kind: 'everything' }
    | { kind: 'ground'; root: string }
    | { kind: 'source' }
    | { kind: 'test' };

const TEST_FILE = /\.(?:test|test-d|spec)\.[cm]?[jt]sx?$|\.spec\.ya?ml$/u;

const CODE_FILE = /\.(?:[cm]?[jt]sx?|astro|svelte|vue)$/u;

/** Whether a file is code a test may load: a module of the project outside the ground its tests read — a `__setup__/` helper and a root config included, since a test loads sources through them. */
export const isLoadable = (path: string): boolean =>
    CODE_FILE.test(path) && roleOf(path).kind !== 'ground';

// invariant: a test reads the ground of its own folder and of the folders above it — `../__fixtures__/`, never a sibling's — so a ground file is read by the tests under the folder that holds its ground folder.
// invariant: a `__setup__/` file is loaded by a project's config as well as imported, a root file configures the run itself, and a data file is read by code no import names: each reaches every test.
export function roleOf(path: string): Role {
    const folders = path.split('/').slice(0, -1);
    const ground = folders.findIndex((folder) => GROUND_FOLDERS.includes(folder));
    if (ground !== -1) {
        return { kind: 'ground', root: folders.slice(0, ground).join('/') };
    }
    if (TEST_FILE.test(path)) {
        return { kind: 'test' };
    }
    if (folders.includes(SETUP_FOLDER) || folders.length === 0 || !CODE_FILE.test(path)) {
        return { kind: 'everything' };
    }

    return { kind: 'source' };
}

/** Whether a test file stands under the folder a ground file belongs to. */
export const isUnder = (file: string, root: string): boolean =>
    root === '' || file.startsWith(`${root}/`);

const RELATIVE = /(?<quote>['"`])\.{1,2}\/[^'"`\s]+\k<quote>/gu;

const BUILT_TO_SOURCE: readonly (readonly [string, readonly string[]])[] = [
    ['.js', ['.ts', '.tsx']],
    ['.jsx', ['.tsx']],
    ['.mjs', ['.mts']],
    ['.cjs', ['.cts']],
];

function candidatesOf(target: string): string[] {
    const swapped = BUILT_TO_SOURCE.filter(([built]) => target.endsWith(built)).flatMap(
        ([built, sources]) => sources.map((source) => `${target.slice(0, -built.length)}${source}`),
    );

    return [target, ...swapped, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`];
}

/** The files of `known` a module names by a relative path — an import, an export, a dynamic import, a mock, any quoted `./` or `../` — so the reach errs wide, never narrow. */
export function namedBy(file: string, text: string, known: ReadonlySet<string>): string[] {
    return [...text.matchAll(RELATIVE)].flatMap(([quoted]) => {
        const target = posix.normalize(posix.join(posix.dirname(file), quoted.slice(1, -1)));
        const found = candidatesOf(target).find((candidate) => known.has(candidate));

        return found === undefined ? [] : [found];
    });
}

/** What of the package's own build a module may load by a bare specifier: its name with the subpaths its `exports` opens — any, where it declares none — and the keys of its `imports`, each a key whose target holds code. */
export type OwnBuild = {
    exports: readonly string[] | undefined;
    imports: readonly string[];
    name: string | undefined;
};

const DATA_TARGET = /\.(?:json|d\.[cm]?ts)$/u;

const leavesOf = (target: unknown): string[] =>
    typeof target === 'string'
        ? [target]
        : Object.values(objectOf(target)).flatMap((value) => leavesOf(value));

// invariant: a key whose every target is a JSON file or a declaration loads no code a source is built into — a JSON target is data, and a change to data drops a report whole.
const codeKeysOf = (map: unknown): string[] =>
    Object.entries(objectOf(map))
        .filter(([, target]) => leavesOf(target).some((leaf) => !DATA_TARGET.test(leaf)))
        .map(([key]) => key);

/** The specifiers a package's manifest resolves to its own build; a manifest whose `exports` is a string or holds conditions alone opens the bare name only. */
export function ownBuildOf(manifest: Record<string, unknown> | undefined): OwnBuild {
    const exported = manifest?.exports;
    const opensSubpaths = Object.keys(objectOf(exported)).some((key) => key.startsWith('.'));

    return {
        exports: exported === undefined ? undefined : opensSubpaths ? codeKeysOf(exported) : ['.'],
        imports: codeKeysOf(manifest?.imports),
        name: stringOf(manifest?.name) ?? undefined,
    };
}

const literalHead = (key: string): string => String(key.split('*')[0]);

// invariant: a key holds at most one `*`, which stands for any text; a template resolves to what its parts become at run time, so it resolves wherever the text before its first `${` and a key's text before its `*` could open the same specifier.
function resolves(specifier: string, keys: readonly string[], template: boolean): boolean {
    const head = String(specifier.split('${')[0]);

    return keys.some((key) => {
        if (template && specifier.includes('${')) {
            return head.startsWith(literalHead(key)) || key.startsWith(head);
        }
        const star = key.indexOf('*');

        return star === -1
            ? specifier === key
            : specifier.startsWith(key.slice(0, star)) && specifier.endsWith(key.slice(star + 1));
    });
}

const QUOTED = /(?<quote>['"`])(?<specifier>[^'"`\s]+)\k<quote>/gu;

const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/u;

// invariant: an `import type` or `export type` statement is erased before the module runs, so the specifier it names loads nothing.
const TYPE_ONLY = /\b(?:import|export)\s+type\s[^;]*?\bfrom\s*(?<quote>['"])[^'"]*\k<quote>/gu;

/** Whether a module names a specifier the package resolves to its own build: a `#` import its manifest declares, or its name with a subpath its `exports` opens — a `#!` line, a heading, a comment, a type-only import or the name held as data loads nothing. */
export function namesItsOwnBuild(text: string, build: OwnBuild): boolean {
    const uncommented = text
        .split('\n')
        .filter((line) => !COMMENT_LINE.test(line))
        .join('\n');
    // Stryker disable next-line StringLiteral: what replaces a type-only statement holds no quote, so it names no specifier whatever its text
    const code = uncommented.replaceAll(TYPE_ONLY, '');

    return [...code.matchAll(QUOTED)].some((match) => {
        const specifier = String(match[2]);
        const template = match[1] === '`';
        if (specifier.startsWith('#')) {
            return resolves(specifier, build.imports, template);
        }
        if (build.name === undefined || !`${specifier}/`.startsWith(`${build.name}/`)) {
            return false;
        }

        return (
            build.exports === undefined ||
            resolves(`.${specifier.slice(build.name.length)}`, build.exports, template)
        );
    });
}

/** What a test file can load in its own process: the modules its imports reach, or every source where one of them loads the package's build. */
export type Reach = { everything: boolean; files: ReadonlySet<string> };

/** The reach of each file, walked once: what a module names, what those name, to the end. */
export function reachOf(
    sources: ReadonlyMap<string, string>,
    build: OwnBuild,
): (file: string) => Reach {
    const known = new Set(sources.keys());
    const memo = new Map<string, Reach>();

    return (file) => {
        const held = memo.get(file);
        if (held !== undefined) {
            return held;
        }
        const files = new Set<string>();
        let everything = false;
        const pending = [file];
        for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
            const text = sources.get(next);
            if (text === undefined) {
                continue;
            }
            everything ||= namesItsOwnBuild(text, build);
            for (const named of namedBy(next, text, known)) {
                if (!files.has(named)) {
                    files.add(named);
                    pending.push(named);
                }
            }
        }
        const reach = { everything, files };
        memo.set(file, reach);

        return reach;
    };
}
