export default {
    plugins: ['typescript', 'unicorn'],
    rules: {
        'prefer-const': 'off',
        'typescript/promise-function-async': 'error',
        'unicorn/prefer-node-protocol': 'error',
    },
};
