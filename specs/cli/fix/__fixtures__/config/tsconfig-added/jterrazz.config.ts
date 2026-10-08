export default {
    kind: 'library',
    platform: 'node',
    typescript: {
        tsconfig: {
            files: ['types/ambient.d.ts'],
            include: ['scripts/**/*.mts'],
            reason: 'the release scripts are typed modules, and the ambient types name the kit nothing imports',
        },
    },
};
