export default {
    typescript: {
        architecture: {
            hexagonal: true,
            layers: [
                {
                    fix: 'read the order through the service, which owns the store',
                    from: { path: '^src/handlers/' },
                    name: 'handlers-reach-services',
                    read: 'docs/01-architecture.md#layers',
                    to: { path: '^src/store/' },
                    why: 'a handler speaks HTTP and hands the work to a service',
                },
            ],
        },
    },
};
