export default {
    typescript: {
        architecture: {
            layers: [
                {
                    name: 'domain-reaches-no-store',
                    from: { path: 'domain/' },
                    to: { path: 'infrastructure/' },
                    why: 'the repository keeps its domain away from its stores',
                    fix: 'reach the store through the composition root',
                    read: 'docs/concepts/architecture.md#layers',
                },
            ],
        },
    },
};
