export default {
    overrides: [{ files: ['**/*.test.ts'], rules: { 'no-var': 'error' } }],
    rules: { 'no-var': 'allow' },
};
