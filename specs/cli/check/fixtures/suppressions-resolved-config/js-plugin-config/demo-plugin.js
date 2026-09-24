export default {
    meta: { name: 'demo' },
    rules: {
        one: { create: () => ({}), meta: { messages: { never: 'never reported.' } } },
        other: {
            create: (context) => ({
                VariableDeclarator(node) {
                    if (node.id?.name === 'flagged') {
                        context.report({ messageId: 'flagged', node });
                    }
                },
            }),
            meta: {
                messages: { flagged: 'a binding named flagged is what this rule is armed for.' },
            },
        },
    },
};
