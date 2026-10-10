export default {
    plugins: ['typescript', 'unicorn'],
    rules: { 'typescript/promise-function-async': 'off' },
    overrides: [{ files: ['**/*.ts'], rules: { 'typescript/promise-function-async': 'error' } }],
};
