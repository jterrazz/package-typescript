#!/usr/bin/env node

import { BASE_PRESETS } from './base-presets.js';
import { BASELINE_SECTION } from './consumer/catalogue/preset.js';
import { runChecker } from './engine/checker/checker.js';
import { ENGINE_COMMANDS } from './engine/checker/engine-commands.js';
import type { Held, Passes } from './engine/checker/pass.js';

const PASSES: Passes = Object.freeze({
    async architecture() {
        const { architecture } = await import('./consumer/checks/architecture.js');

        return architecture;
    },
    async comments() {
        const { comments } = await import('./consumer/checks/comments.js');

        return comments;
    },
    async docs() {
        const [{ auditDocs, HEAD_LINES }, { readDocsTree }] = await Promise.all([
            import('./consumer/checks/docs.js'),
            import('./engine/project/docs-tree.js'),
        ]);

        return {
            check: ({ root }) => ({ findings: [...auditDocs(readDocsTree(root, HEAD_LINES))] }),
        };
    },
    async drift() {
        const { drift } = await import('./consumer/checks/drift.js');

        return drift;
    },
    async gitignore() {
        const { gitignore } = await import('./consumer/checks/gitignore.js');

        return gitignore;
    },
    async markdown() {
        const { markdown } = await import('./consumer/checks/markdown.js');

        return markdown;
    },
    async names() {
        const { names } = await import('./consumer/checks/names.js');

        return names;
    },
    async publish() {
        const { publish } = await import('./consumer/checks/publish.js');

        return publish;
    },
    async secrets() {
        const { secrets } = await import('./consumer/checks/secrets.js');

        return secrets;
    },
    async suppressions() {
        const { suppressions } = await import('./consumer/checks/suppressions.js');

        return suppressions;
    },
});

const HELD: Held = Object.freeze({
    lower: 'typescript fix',
    passes: Object.freeze(['architecture', 'comments', 'names']),
    read: 'docs/06-quality-checks.md#what-jterrazzbaselinejson-still-holds',
    record: 'typescript baseline',
    section: BASELINE_SECTION,
});

if (import.meta.main) {
    await runChecker({
        commands: ENGINE_COMMANDS,
        held: HELD,
        passes: PASSES,
        presets: BASE_PRESETS,
    });
}
