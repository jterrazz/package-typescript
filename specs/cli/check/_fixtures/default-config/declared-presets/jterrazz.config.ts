export default {
    presets: [
        { name: 'typescript', package: '@jterrazz/typescript', settings: { profile: 'react' } },
        {
            name: 'counting',
            oxlint: { rules: { 'no-plusplus': 'error' } },
            package: '@acme/counting',
        },
    ],
};
