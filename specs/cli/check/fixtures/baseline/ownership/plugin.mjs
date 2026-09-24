export default {
    meta: { name: 'jterrazz' },
    rules: {
        'x1-every-file': {
            create(context) {
                return {
                    Program(node) {
                        context.report({ message: 'reported by the stub plugin', node });
                    },
                };
            },
        },
    },
};
