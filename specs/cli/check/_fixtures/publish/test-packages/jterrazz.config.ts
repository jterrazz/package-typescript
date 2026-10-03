export default {
    typescript: {
        build: {
            entries: { testing: { reason: 'the fixtures a sibling package loads by path', source: 'src/testing.ts' } },
        },
    },
};
