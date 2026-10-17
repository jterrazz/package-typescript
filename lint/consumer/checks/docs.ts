// invariant: the single executable copy of the rule ids and of each sentence they print; pages name ids, never
// messages. Nothing here reads the filesystem, so a clone nobody installed into is judged the same.
import type { DocsTree } from '../../kit/project/docs-tree.js';
import { auditDecisions } from './docs.decisions.js';
import type { DocsRule, Report } from './docs.decisions.js';
import { auditLinks } from './docs.links.js';
import { auditPages, pagesOf, SECTIONS } from './docs.pages.js';
import type { Page } from './docs.pages.js';

export type { DocsTree } from '../../kit/project/docs-tree.js';
export { DOCS_RULES } from './docs.decisions.js';
export type { DocsRule } from './docs.decisions.js';

/** One broken rule, naming the path it is about and the sentence the gate prints. */
export type DocsViolation = {
    readonly message: string;
    readonly path: string;
    readonly rule: DocsRule;
};

/** How many opening lines of a file a rule may read. */
export const HEAD_LINES = 20;

const FOLDERS: readonly string[] = [...SECTIONS, 'decisions/', '_assets/'];

function directChildren(files: readonly string[]): string[] {
    return files.filter((path) => /^docs\/[^/]+\/?$/u.test(path));
}

function targetPath(link: string): string {
    // Stryker disable next-line Regex: a map link carries `./` at its head or nowhere
    return (link.split('#')[0] ?? '').replace(/^\.\//u, '');
}

function isPageLink(target: string): boolean {
    return SECTIONS.some((section) => target.startsWith(section));
}

function auditMap(
    report: Report,
    {
        files,
        links,
        pages,
    }: { files: readonly string[]; links: readonly string[]; pages: readonly Page[] },
): void {
    if (!files.includes('docs/README.md')) {
        report(
            'docs/map-present',
            'docs/README.md',
            'docs/README.md is missing: the map is the one file an outside corpus points at',
        );

        return;
    }

    const rows = [...new Set(links.map((link) => targetPath(link)).filter(isPageLink))];
    const listed = pages.filter((page) => !page.name.includes('/'));

    for (const row of rows) {
        if (!listed.some((page) => page.path === `docs/${row}`)) {
            report(
                'docs/map-matches-pages',
                'docs/README.md',
                `docs/README.md and the pages disagree: ${row} has no file`,
            );
        }
    }
    for (const page of listed) {
        const row = page.path.slice('docs/'.length);
        if (!rows.includes(row)) {
            report(
                'docs/map-matches-pages',
                'docs/README.md',
                `docs/README.md and the pages disagree: ${row} has no row`,
            );
        }
    }

    for (const link of links) {
        const target = targetPath(link);
        const routes = target === '' || isPageLink(target) || target.startsWith('decisions/');

        if (!routes) {
            report(
                'docs/map-links-only-pages',
                'docs/README.md',
                `docs/README.md links ${link}: the map routes to its own pages and nothing else`,
            );
        }
    }
}

function auditFolder(report: Report, { children }: { children: readonly string[] }): void {
    for (const path of children) {
        const name = path.slice('docs/'.length);

        if (name.endsWith('/')) {
            if (!FOLDERS.includes(name)) {
                report(
                    'docs/no-unknown-subfolder',
                    path,
                    `${path} is not one of ${FOLDERS.join(', ')}`,
                );
            }
        } else if (name !== 'README.md') {
            report(
                'docs/no-loose-file',
                path,
                `${path} sits outside the sections; move it under start/, guides/, concepts/ or reference/, or under _assets/ if a page embeds it`,
            );
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
                    'docs/ is missing: every repository carries its own manual, starting at docs/README.md',
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
    const pages = pagesOf(files);
    const heads = tree.heads ?? {};
    const links = tree.links ?? {};

    auditMap(report, { files, links: links['docs/README.md'] ?? [], pages });
    auditPages(report, { pages, ships: tree.ships });
    auditFolder(report, { children });
    auditDecisions(report, { files, heads });

    if (tree.agents?.includes('docs/README.md') !== true) {
        report(
            'docs/agents-route-to-the-map',
            'AGENTS.md',
            'AGENTS.md does not route to docs/README.md: the brief is a map, not a manual',
        );
    }

    auditLinks(report, { links });

    return violations;
}
