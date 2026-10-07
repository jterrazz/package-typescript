export default {
    typescript: {
        knip: {
            ignoreDependencies: {
                'some-local-dep': 'loaded by a plugin the build names, which knip cannot trace',
            },
        },
    },
};
