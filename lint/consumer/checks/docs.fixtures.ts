import { auditDocs } from './docs.js';
import type { DocsTree } from './docs.js';

/** The smallest compliant manual: each test breaks exactly one thing. */
export function manual(overrides: Partial<DocsTree> = {}): DocsTree {
    return {
        agents: '# Agent brief\n\nThe corpus is docs/README.md.\n',
        files: [
            'docs/',
            'docs/README.md',
            'docs/concepts/',
            'docs/concepts/architecture.md',
            'docs/guides/',
            'docs/guides/develop.md',
            'docs/guides/test.md',
        ],
        heads: {},
        links: {
            'docs/README.md': ['concepts/architecture.md', 'guides/develop.md', 'guides/test.md'],
        },
        ships: { dockerfile: false, infrastructure: false, publishable: false },
        ...overrides,
    };
}

export function rulesBrokenBy(tree: DocsTree) {
    return auditDocs(tree).map((violation) => violation.rule);
}

export function messageOf(tree: DocsTree, rule: string) {
    return auditDocs(tree).find((violation) => violation.rule === rule)?.message;
}

export function violationOf(tree: DocsTree, rule: string) {
    const found = auditDocs(tree).find((violation) => violation.rule === rule);

    return found === undefined ? undefined : { message: found.message, path: found.path };
}

export function withDecisions(overrides: Record<string, unknown> = {}) {
    return manual({
        files: [
            ...manual().files,
            'docs/decisions/',
            'docs/decisions/001-the-first-call.md',
            'docs/decisions/_template.md',
        ],
        heads: {
            'docs/decisions/001-the-first-call.md': [
                '# ADR-001: The first call',
                '',
                '**Status:** Accepted',
            ],
        },
        ...overrides,
    });
}
