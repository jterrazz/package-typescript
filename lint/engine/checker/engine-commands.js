export const ENGINE_COMMANDS = Object.freeze({
    async architecture() {
        const { architecture } = await import('./architecture.js');

        return architecture;
    },
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
