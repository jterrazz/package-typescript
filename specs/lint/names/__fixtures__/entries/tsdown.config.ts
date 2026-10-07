export default [
    {
        entry: {
            config: 'src/config.ts',
            index: 'src/index.ts',
            rules: 'lint/index.rules.ts',
            'rules.browser': 'lint/index.rules.node.ts',
            tool: 'src/tool.ts',
        },
    },
];
