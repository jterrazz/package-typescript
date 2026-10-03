import { auditDocs } from './docs.js';
import type { DocsTree } from './docs.js';

/** The smallest compliant manual: each test breaks exactly one thing. */
export function manual(overrides: Partial<DocsTree> = {}): DocsTree {
    return {
        agents: '# Agent brief\n\nThe corpus is docs/README.md.\n',
        files: [
            'docs/',
            'docs/01-architecture.md',
            'docs/02-developing.md',
            'docs/03-testing.md',
            'docs/README.md',
        ],
        heads: {},
        links: {
            'docs/README.md': ['01-architecture.md', '02-developing.md', '03-testing.md'],
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
