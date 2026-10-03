import type { DocsTree } from '../../kit/project/docs-tree.js';
import type { Report } from './docs.decisions.js';

// invariant: a result still opening on `..` climbed above the repository root.
function resolveLink(from: string, link: string): string[] {
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

    return stack;
}

export function auditLinks(report: Report, { links }: { links: DocsTree['links'] }): void {
    for (const [path, targets] of Object.entries(links)) {
        for (const link of targets) {
            if (link.startsWith('/') || resolveLink(path, link)[0] === '..') {
                report(
                    'docs/no-cross-repository-link',
                    path,
                    `${path} links ${link}: another repository's tree is not a place this manual may reach`,
                );
            }
        }
    }
}
