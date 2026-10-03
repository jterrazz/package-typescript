import type { KitCommand } from './pass.js';

export const KIT_COMMANDS: Readonly<Record<string, () => Promise<KitCommand>>> = Object.freeze({
    async baseline() {
        const { baseline } = await import('./baseline.js');

        return baseline;
    },
    async 'entry-points'() {
        const { entryPointsQuery } = await import('./project-queries.js');

        return entryPointsQuery;
    },
    async 'test-package'() {
        const { testPackageQuery } = await import('./project-queries.js');

        return testPackageQuery;
    },
    async 'workspace-members'() {
        const { workspaceMembersQuery } = await import('./project-queries.js');

        return workspaceMembersQuery;
    },
});
