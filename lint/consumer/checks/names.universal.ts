import type { Finding } from '../../kit/checker/pass.js';
import { namesFinding } from './names.lessons.js';
import type { LintTree } from './names.lint-tree.js';

export type Universal = {
    constructs: ReadonlySet<string>;
    grabBag: ReadonlySet<string>;
    lint: LintTree;
    memberRoots: ReadonlySet<string>;
    shortcuts: ReadonlySet<string>;
    spine: ReadonlySet<string>;
    toolRoots: Readonly<Record<string, string>>;
};

type Named = { fileName?: string; name: string };

const CONSTRUCT_SUFFIX = 'types';

// invariant: a swept root's own name is the toolchain's, never judged: `lib/` is also a grab-bag word.
const SWEPT: ReadonlySet<string> = new Set([
    'apps',
    'bin',
    'lib',
    'lint',
    'packages',
    'specs',
    'src',
    'tests',
]);

// outside: below `app/`, a Next.js directory is a URL the product serves, not a name the tree chose.
const ROUTER_ROOT = 'app';

const unmarked = (name: string): string => name.replace(/^_/u, '').toLowerCase();

// invariant: a name is read segment by segment, split on the hyphen; the `_` marker excuses none.
const isShortcut = (name: string, { shortcuts }: Universal): boolean =>
    unmarked(name)
        .split('-')
        .some((segment) => shortcuts.has(segment));

const hasConstructSuffix = (fileName: string): boolean =>
    fileName.split('.').slice(1, -1).includes(CONSTRUCT_SUFFIX);

const stemOf = (name: string): string => name.split('.')[0] ?? '';

function namesOf(files: readonly string[]): [string, Named][] {
    const named = new Map<string, Named>();

    for (const file of files) {
        const segments = file.split('/');
        if (!SWEPT.has(segments[0] ?? '') || segments.length < 2) {
            continue;
        }

        const routerRoot = segments.indexOf(ROUTER_ROOT, 1);
        const lastJudged = routerRoot === -1 ? segments.length - 1 : routerRoot + 1;
        for (let index = 1; index < Math.min(lastJudged, segments.length - 1); index += 1) {
            const path = segments.slice(0, index + 1).join('/');
            named.set(path, { name: segments[index] ?? '' });
        }
        const fileName = segments.at(-1) ?? '';
        named.set(file, { fileName, name: stemOf(fileName) });
    }

    return [...named].toSorted(([left], [right]) => (left < right ? -1 : 1));
}

// invariant: a word the grab-bag roster already refuses is left to it, so a name is reported once.
export function findingsOf(files: readonly string[], universal: Universal): Finding[] {
    const findings: Finding[] = [];

    for (const [path, { fileName, name }] of namesOf(files)) {
        if (universal.grabBag.has(unmarked(name))) {
            findings.push(
                namesFinding('names/no-grab-bag-name', path, {
                    fix: 'name it for the subject it holds, or move what it holds beside the code that uses it',
                    found: `\`${name}\` names no subject — it holds whatever nobody placed`,
                }),
            );
        } else if (
            universal.constructs.has(unmarked(name)) ||
            (fileName !== undefined && hasConstructSuffix(fileName))
        ) {
            findings.push(
                namesFinding('names/no-language-construct-name', path, {
                    fix: 'name it for the subject it holds',
                    found: `\`${fileName ?? name}\` names a construct of the language`,
                }),
            );
        }
        if (isShortcut(name, universal)) {
            findings.push(
                namesFinding('names/no-abbreviated-word', path, {
                    fix: 'spell every word of it whole',
                    found: `\`${name}\` is a word written in half`,
                }),
            );
        }
    }

    return findings;
}
