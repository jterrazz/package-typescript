export default {
    typescript: {
        architecture: {
            layers: [
                {
                    from: { path: '^src/domain/' },
                    name: 'domain-stays-pure',
                    to: { path: '^src/infrastructure/' },
                },
            ],
        },
    },
};
