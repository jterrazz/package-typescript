const owner = {
    name: 'owner',
    oxlint: {
        overrides: [
            {
                files: ['**/*.test.ts'],
                rules: {
                    'vitest/no-restricted-matchers': [
                        'error',
                        { toMatchSnapshot: 'compare the golden with `toStrictEqual` instead' },
                    ],
                },
            },
        ],
    },
    package: '@acme/owner',
};

export default { kind: 'library', platform: 'node', presets: [owner] };
