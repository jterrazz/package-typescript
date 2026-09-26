export default {
    meta: { name: 'jterrazz' },
    rules: {
        'flags-every-file': {
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
