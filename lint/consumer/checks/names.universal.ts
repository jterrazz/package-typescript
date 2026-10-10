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

// outside: @jterrazz/test files a spec under `specs/<specification>/<subject>/`, the subject being the command, the route or the page the spec proves: a name the product chose (`auth`, `db`), never one the tree did.
const SPECIFICATIONS: ReadonlySet<string> = new Set([
    'api',
    'cli',
    'component',
    'integration',
    'job',
    'mobile',
    'website',
]);

// outside: below `app/`, a Next.js directory is a URL the product serves, not a name the tree chose.
const ROUTER_ROOT = 'app';

const unmarked = (name: string): string => name.replace(/^_/u, '').toLowerCase();

// invariant: under a specs tree a `_shared/` is @jterrazz/test's closed-list rule's, whose fix names the special folders it became.
const IN_SPECS = /(?:^|\/)specs\//u;

// invariant: `shared` names a property a plain folder may hold, but behind the `_` it restates the mark — what the row shares — and says nothing of what.
const restatesTheMark = (path: string, name: string): boolean =>
    name.startsWith('_') && unmarked(name) === 'shared' && !IN_SPECS.test(path);

// invariant: a name is read segment by segment, split on the hyphen; the `_` marker excuses none.
const isShortcut = (name: string, { shortcuts }: Universal): boolean =>
    unmarked(name)
        .split('-')
        .some((segment) => shortcuts.has(segment));

const hasConstructSuffix = (fileName: string): boolean =>
    fileName.split('.').slice(1, -1).includes(CONSTRUCT_SUFFIX);

const stemOf = (name: string): string => name.split('.')[0] ?? '';

// invariant: the folders of a path are judged down to the first level below a specification folder, whose subjects are the product's own words; a router root ends the walk one level in.
function judgedDepth(segments: readonly string[]): number {
    const routerRoot = segments.indexOf(ROUTER_ROOT, 1);
    const underSpecification = segments[0] === 'specs' && SPECIFICATIONS.has(segments[1] ?? '');

    return Math.min(
        routerRoot === -1 ? Infinity : routerRoot + 1,
        underSpecification ? 2 : Infinity,
        segments.length - 1,
    );
}

function namesOf(files: readonly string[]): [string, Named][] {
    const named = new Map<string, Named>();

    for (const file of files) {
        const segments = file.split('/');
        if (!SWEPT.has(segments[0] ?? '') || segments.length < 2) {
            continue;
        }

        for (let index = 1; index < judgedDepth(segments); index += 1) {
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
        if (restatesTheMark(path, name)) {
            findings.push(
                namesFinding('names/no-grab-bag-name', path, {
                    fix: 'name it for what its files share (`_taxonomy/`, never `_shared/`), or move a lone file beside the code that uses it',
                    found: `\`${name}\` names no subject — its \`_\` already says the row shares it, and the word says it again`,
                }),
            );
        } else if (universal.grabBag.has(unmarked(name))) {
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
