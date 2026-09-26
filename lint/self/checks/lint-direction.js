import { LINT_TREE } from '../../consumer/checks/names.lint-tree.js';

const SELF = '**/self/**';
const SOURCE = '**/src/**';
const ENGINE = '**/engine/**';
const CONSUMER = '**/consumer/**';

const READS = {
    consumer: { allow: [ENGINE], deny: [SELF], reaches: 'catalogue/ and engine/ alone' },
    self: { allow: [ENGINE, CONSUMER], deny: [], reaches: 'catalogue/, consumer/ and engine/' },
};

function audienceFolder(audience, folder) {
    const isCatalogue = folder === 'catalogue';
    const siblings = LINT_TREE[audience].filter(
        (other) => other !== folder && (isCatalogue || other !== 'catalogue'),
    );
    const reads = READS[audience];

    return {
        allow: isCatalogue ? [ENGINE] : reads.allow,
        deny: [
            ...siblings.map((other) => `**/${other}/**`),
            ...(isCatalogue ? [CONSUMER, SELF] : reads.deny),
            SOURCE,
        ].filter((glob) => glob !== `**/${audience}/**`),
        files: [`lint/${audience}/${folder}/**`],
        message: `lint/${audience}/${folder}/ reaches ${isCatalogue ? 'engine/ alone — it is data at the bottom of the arrow' : reads.reaches}, never src/`,
        name: `lint/${audience}/${folder}`,
    };
}

export const LINT_DIRECTION = {
    id: 'lint-direction',
    map: [
        {
            deny: [CONSUMER, SELF, SOURCE],
            files: ['lint/engine/**'],
            message:
                'lint/engine/ runs declarations and knows none — it receives them from an index, never imports consumer/, self/ nor src/',
            name: 'lint/engine',
        },
        ...LINT_TREE.consumer.map((folder) => audienceFolder('consumer', folder)),
        ...LINT_TREE.self.map((folder) => audienceFolder('self', folder)),
        {
            deny: [SELF, SOURCE],
            files: ['lint/index.*'],
            message:
                'the shipped entry imports neither self/ (never shipped) nor src/ (the command)',
            name: 'lint/index',
        },
        {
            deny: [SOURCE],
            files: ['lint/self/index.*'],
            message: 'lint/self/ holds this repository to account through lint/, never src/',
            name: 'lint/self/index',
        },
        {
            deny: [SELF],
            files: ['src/**'],
            message: 'src/ runs what lint/ declares, never self/',
            name: 'src',
        },
    ],
};
