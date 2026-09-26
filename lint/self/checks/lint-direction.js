import { LINT_TREE } from '../../consumer/checks/names.lint-tree.js';

const SELF = '**/self/**';
const SOURCE = '**/src/**';
const ENGINE = '**/engine/**';
const CONSUMER = '**/consumer/**';

const READS = {
    consumer: {
        allow: [ENGINE],
        deny: [SELF, SOURCE],
        reaches: 'catalogue/ and engine/ alone, never src/',
    },
    self: {
        allow: [ENGINE, CONSUMER],
        deny: [],
        reaches: 'catalogue/, consumer/, engine/ and src/ — never shipped, it judges the product',
    },
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
            ...(isCatalogue ? [CONSUMER, SELF, SOURCE] : reads.deny),
        ].filter((glob) => glob !== `**/${audience}/**`),
        files: [`lint/${audience}/${folder}/**`],
        message: `lint/${audience}/${folder}/ reaches ${isCatalogue ? 'engine/ alone — it is data at the bottom of the arrow' : reads.reaches}`,
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
            deny: [SELF],
            files: ['src/**'],
            message: 'src/ runs what lint/ declares, never self/',
            name: 'src',
        },
    ],
};
