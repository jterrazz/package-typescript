export default {
    kind: 'library',
    platform: 'node',
    typescript: {
        mutation: {
            presentation: {
                'src/headline.ts': 'src/__tests__/headline.test.ts compares the headline whole',
            },
        },
    },
};
