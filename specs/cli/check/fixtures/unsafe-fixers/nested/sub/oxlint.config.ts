export default {
    plugins: ['unicorn'],
    rules: {
        'prefer-const': 'off',
        'unicorn/no-useless-undefined': 'error',
        'unicorn/prefer-node-protocol': 'error',
    },
};
