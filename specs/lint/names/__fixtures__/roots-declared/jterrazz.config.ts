export default {
    kind: 'website',
    platform: 'next',
    typescript: {
        roots: {
            'apps/playground': 'an Expo app with an install of its own',
            docker: '',
            migrations: 'the SQL the release job applies',
            scripts: 'the release scripts the CI workflow runs',
            src: 'the code',
        },
    },
};
