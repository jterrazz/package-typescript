export default {
    plugins: ['import', 'unicorn'],
    rules: {
        'import/no-absolute-path': 'error',
        'unicorn/no-useless-undefined': 'error',
    },
};
