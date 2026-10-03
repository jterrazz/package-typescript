export default {
    kind: 'website',
    platform: 'react',
    presets: [
        {
            name: 'counting',
            oxlint: { rules: { 'no-plusplus': 'error' } },
            package: '@acme/counting',
        },
    ],
};
