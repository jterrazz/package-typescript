import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { BASELINE_SECTION, basePresetsOf } from './consumer/catalogue/preset.js';
import { runChecker, runContribution } from './kit/checker/checker.js';
import { KIT_COMMANDS } from './kit/checker/kit-commands.js';
import type { Held, Passes } from './kit/checker/pass.js';

const PASSES: Passes = Object.freeze({
    async config() {
        const { config } = await import('./consumer/checks/config.js');

        return config;
    },
    async architecture() {
        const { architecture } = await import('./consumer/checks/architecture.js');

        return architecture;
    },
    async comments() {
        const { comments } = await import('./consumer/checks/comments.js');

        return comments;
    },
    async docs() {
        const [{ auditDocs, HEAD_LINES }, { readDocsTree }, { publishes }] = await Promise.all([
            import('./consumer/checks/docs.js'),
            import('./kit/project/docs-tree.js'),
            import('./kit/project/project-kind.js'),
        ]);

        return {
            async check({ config, root }) {
                const { resolved } = await config();
                const publishable = publishes(resolved.declaration);
                const tree = readDocsTree(root, { headLines: HEAD_LINES, publishable });

                return { findings: [...auditDocs(tree)] };
            },
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
    read: 'docs/07-quality-checks.md#what-jterrazzbaselinejson-still-holds',
    record: 'typescript baseline',
    section: BASELINE_SECTION,
});

const [first, module = '', ...rest] = process.argv.slice(2);

if (import.meta.main && first === '--preset') {
    await runContribution(await import(pathToFileURL(module).href), basePresetsOf, rest);
} else if (import.meta.main) {
    await runChecker({ commands: KIT_COMMANDS, held: HELD, passes: PASSES, base: basePresetsOf });
}
