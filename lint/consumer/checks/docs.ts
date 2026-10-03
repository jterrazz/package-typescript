// invariant: the single executable copy of the rule ids and of each sentence they print; pages name ids, never
// messages. Nothing here reads the filesystem, so a clone nobody installed into is judged the same.
import type { DocsTree } from '../../kit/project/docs-tree.js';
import { auditChapters } from './docs.chapters.js';
import type { Chapter } from './docs.chapters.js';
import { auditDecisions } from './docs.decisions.js';
import type { Report } from './docs.decisions.js';

export type { DocsTree } from '../../kit/project/docs-tree.js';

/** One broken rule, naming the path it is about and the sentence the gate prints. */
export type DocsViolation = {
    readonly message: string;
    readonly path: string;
    readonly rule: string;
};

/** How many opening lines of a file a rule may read. */
export const HEAD_LINES = 20;

const SUBFOLDERS: ReadonlySet<string> = new Set(['_assets/', 'decisions/']);

// invariant: a generated API reference is a second copy of the types an editor resolves: refused by name.
const GENERATED_REFERENCE = 'reference/';

const SCHEME = /^[a-z][\d+.a-z-]*:/iu;

function directChildren(files: readonly string[]): string[] {
    return files.filter((path) => /^docs\/[^/]+\/?$/u.test(path));
}

function targetPath(link: string): string {
    return (link.split('#')[0] ?? '').replace(/^\.\//u, '');
}

function isChapterLink(target: string): boolean {
    return /^\d/u.test(target) && !target.includes('/');
}

// invariant: a result still opening on `..` climbed above the repository root.
function resolveLink(from: string, link: string): string {
    const stack: string[] = [];

    for (const segment of [...from.split('/').slice(0, -1), ...link.split('/')]) {
        if (segment === '' || segment === '.') {
            continue;
        }
        if (segment !== '..') {
            stack.push(segment);
        } else if (stack.length === 0 || stack.at(-1) === '..') {
            stack.push('..');
        } else {
            stack.pop();
        }
    }

    return stack.join('/');
}

function auditMap(
    report: Report,
    {
        chapters,
        files,
        links,
    }: { chapters: readonly Chapter[]; files: readonly string[]; links: readonly string[] },
): void {
    if (!files.includes('docs/README.md')) {
        report(
            'docs/map-present',
            'docs/README.md',
            'docs/README.md is missing — the map is the one file an outside corpus points at',
        );

        return;
    }

    const rows = [...new Set(links.map((link) => targetPath(link)).filter(isChapterLink))];

    for (const row of rows) {
        if (!chapters.some((chapter) => chapter.name === row)) {
            report(
                'docs/map-matches-chapters',
                'docs/README.md',
                `docs/README.md and the chapters disagree: ${row} has no file`,
            );
        }
    }
    for (const chapter of chapters) {
        if (!rows.includes(chapter.name)) {
            report(
                'docs/map-matches-chapters',
                'docs/README.md',
                `docs/README.md and the chapters disagree: ${chapter.name} has no row`,
            );
        }
    }

    for (const link of links) {
        const target = targetPath(link);
        const routes = target === '' || isChapterLink(target) || target.startsWith('decisions/');

        if (!routes) {
            report(
                'docs/map-links-only-chapters',
                'docs/README.md',
                `docs/README.md links ${link}: the map routes to its own chapters and nothing else`,
            );
        }
    }
}

function auditFolder(report: Report, { children }: { children: readonly string[] }): void {
    for (const path of children) {
        const name = path.slice('docs/'.length);

        if (name === GENERATED_REFERENCE) {
            report(
                'docs/no-generated-reference',
                path,
                `${path} is a generated API reference — the API is the types, and the manual holds no copy of them`,
            );
        } else if (name.endsWith('/')) {
            if (!SUBFOLDERS.has(name)) {
                report(
                    'docs/no-unknown-subfolder',
                    path,
                    `${path} is not one of decisions/, _assets/`,
                );
            }
        } else if (name !== 'README.md' && !/^\d/u.test(name)) {
            report(
                'docs/no-loose-file',
                path,
                `${path} is neither the map nor a chapter — number it, or move it under _assets/`,
            );
        }
    }
}

function auditLinks(
    report: Report,
    { files, links }: { files: readonly string[]; links: DocsTree['links'] },
): void {
    for (const path of files) {
        for (const link of links[path] ?? []) {
            if (link.startsWith('#') || SCHEME.test(link)) {
                continue;
            }
            if (link.startsWith('/') || resolveLink(path, link).startsWith('..')) {
                report(
                    'docs/no-cross-repository-link',
                    path,
                    `${path} links ${link}: another repository's tree is not a place this manual may reach`,
                );
            }
        }
    }
}

// invariant: a repository with no `docs/` gets exactly one violation: every other rule would restate the absence.
/** What breaks the shape of `docs/`, in rule order. An empty array is a compliant manual. */
export function auditDocs(tree: DocsTree): readonly DocsViolation[] {
    const files = tree.files ?? [];

    if (!files.includes('docs/')) {
        return [
            {
                message:
                    'docs/ is missing — every repository carries its own manual, starting at docs/README.md',
                path: 'docs/',
                rule: 'docs/manual-present',
            },
        ];
    }

    const violations: DocsViolation[] = [];
    const report: Report = (rule, path, message) => {
        violations.push({ message, path, rule });
    };

    const children = directChildren(files);
    const chapters = children
        .filter((path) => !path.endsWith('/') && /^\d/u.test(path.slice('docs/'.length)))
        .map((path) => ({
            name: path.slice('docs/'.length),
            number: Number.parseInt(path.slice('docs/'.length), 10),
            path,
        }));
    const heads = tree.heads ?? {};
    const links = tree.links ?? {};

    auditMap(report, { chapters, files, links: links['docs/README.md'] ?? [] });
    auditChapters(report, { chapters, ships: tree.ships });
    auditFolder(report, { children });
    auditDecisions(report, { files, heads });

    if (tree.agents === null || !(tree.agents ?? '').includes('docs/README.md')) {
        report(
            'docs/agents-route-to-the-map',
            'AGENTS.md',
            'AGENTS.md does not route to docs/README.md — the brief is a map, not a manual',
        );
    }

    auditLinks(report, { files, links });

    return violations;
}
