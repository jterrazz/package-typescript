export default {
    plugins: ['unicorn'],
    rules: { 'unicorn/no-useless-undefined': 'off' },
    overrides: [{ files: ['**/*.ts'], rules: { 'unicorn/no-useless-undefined': 'error' } }],
};
