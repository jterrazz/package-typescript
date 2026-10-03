export default {
    kind: 'website',
    platform: 'next',
    typescript: {
        roots: {
            docker: '',
            migrations: 'the SQL the release job applies',
            scripts: 'the release scripts the CI workflow runs',
        },
    },
};
