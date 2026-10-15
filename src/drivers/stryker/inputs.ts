import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

import { ARTIFACTS } from '../../../lint/kit/project/build-plan.js';
import { listNotIgnored } from '../../../lint/kit/project/git-tree.js';
import { GROUND_FOLDERS, SETUP_FOLDER } from '../../../lint/kit/project/ground.js';

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

const RELATIVE = /(?<quote>['"`])(?<specifier>\.{1,2}\/[^'"`\s]+)\k<quote>/gu;

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
    return [...text.matchAll(RELATIVE)].flatMap((match) => {
        const target = posix.normalize(
            posix.join(posix.dirname(file), match.groups?.specifier ?? ''),
        );
        const found = candidatesOf(target).find((candidate) => known.has(candidate));

        return found === undefined ? [] : [found];
    });
}

/** Whether a module names the package by its own name, or by one of its `#` imports: either loads the package's build, which holds every source. */
export function namesItsOwnBuild(text: string, packageName: string | undefined): boolean {
    return (
        /(?<quote>['"])#[^'"]+\k<quote>/u.test(text) ||
        (packageName !== undefined &&
            (text.includes(`'${packageName}'`) ||
                text.includes(`"${packageName}"`) ||
                text.includes(`'${packageName}/`) ||
                text.includes(`"${packageName}/`)))
    );
}

/** What a test file can load in its own process: the modules its imports reach, or every source where one of them loads the package's build. */
export type Reach = { everything: boolean; files: ReadonlySet<string> };

/** The reach of each file, walked once: what a module names, what those name, to the end. */
export function reachOf(
    sources: ReadonlyMap<string, string>,
    packageName: string | undefined,
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
            const text = sources.get(next) ?? '';
            everything ||= namesItsOwnBuild(text, packageName);
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
