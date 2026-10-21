// outside: Stryker's Vitest runner runs every test file on one worker, which a mutant's run needs, since the mutant is live in the process that runs its tests; the dry run activates no mutant and Stryker reads its coverage file by file, so it runs on the stage's test runners, read again on every run.
// invariant: a project that declares `fileParallelism: false` shares state between its files (one app, one port), so it keeps its files in turn in the dry run too; Stryker's own `maxWorkers: 1` is set on every project, so only the declaration tells a serial project from a parallel one.
export const dryRunWorkersPluginSource = (workers: number): string => `const dryRunWorkers = {
    configureVitest({ project, vitest }) {
        if (project.config.fileParallelism === false) {
            return;
        }
        Object.defineProperty(project.config, 'maxWorkers', {
            configurable: true,
            enumerable: true,
            get: () => (vitest.getRootProject().getProvidedContext().mode === 'dry-run' ? ${String(workers)} : 1),
            set: () => {},
        });
    },
    name: 'stryker-dry-run-workers',
};
`;
