export default {
    jsPlugins: ['./demo-plugin.js'],
    overrides: [{ files: ['**/*.ts'], rules: { 'demo/one': 'allow' } }],
    rules: { 'demo/other': 'error' },
};
