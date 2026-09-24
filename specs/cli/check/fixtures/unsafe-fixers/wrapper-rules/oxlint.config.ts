export default {
    plugins: ['import', 'unicorn'],
    rules: {
        'import/extensions': ['error', 'always'],
        'import/no-absolute-path': 'error',
        'unicorn/no-useless-undefined': 'error',
    },
};
