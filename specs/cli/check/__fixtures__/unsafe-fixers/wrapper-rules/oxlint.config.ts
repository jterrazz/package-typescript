export default {
    plugins: ['import', 'typescript', 'unicorn'],
    rules: {
        'import/no-absolute-path': 'error',
        'typescript/promise-function-async': 'error',
    },
};
