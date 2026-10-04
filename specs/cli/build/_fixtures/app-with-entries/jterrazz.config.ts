export default {
    kind: 'api',
    platform: 'node',
    typescript: {
        build: {
            entries: {
                worker: { reason: 'loaded by path into a worker thread', source: 'src/worker.ts' },
            },
        },
    },
};
