export default {
    kind: 'cli',
    platform: 'node',
    typescript: {
        knip: {
            entry: { 'scripts/seed.ts': 'run by its path from the Makefile' },
            ignore: { 'src/vendored.ts': 'copied in whole from upstream, read by nothing yet' },
            ignoreBinaries: { 'seed-db': 'installed on the machine, never by npm' },
            ignoreDependencies: { 'left-pad': 'loaded by name at run time' },
        },
    },
};
