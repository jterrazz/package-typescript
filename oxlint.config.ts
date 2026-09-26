// Self-referenced through the exports map, as a consumer imports it.
import { testing } from '@jterrazz/test/oxlint';
import { compose, defineConfig, layers, node } from '@jterrazz/typescript/oxlint';

const SELF = '**/self/**';
const SOURCE = '**/src/**';
const ENGINE = '**/engine/**';

const DECLARATIONS = ['catalogue', 'rulebook', 'rules', 'checks'] as const;

type Declaration = (typeof DECLARATIONS)[number];

function consumerFolder(folder: Declaration, message: string) {
    return {
        allow: [ENGINE],
        deny: [
            ...DECLARATIONS.filter((other) => other !== folder && other !== 'catalogue').map(
                (other) => `**/${other}/**`,
            ),
            SELF,
            SOURCE,
        ],
        files: [`lint/consumer/${folder}/**`],
        message: `${message}, never self/ nor src/`,
        name: `lint/consumer/${folder}`,
    };
}

const lintDirection = layers({
    id: 'lint-direction',
    map: [
        {
            deny: ['**/consumer/**', SELF, SOURCE],
            files: ['lint/engine/**'],
            message:
                'lint/engine/ runs declarations and knows none — it receives them from an index, never imports consumer/, self/ nor src/',
            name: 'lint/engine',
        },
        consumerFolder(
            'catalogue',
            'lint/consumer/catalogue/ reaches engine/ alone — every rule and decision reads its sentence from it',
        ),
        consumerFolder('rulebook', 'lint/consumer/rulebook/ reaches catalogue/ and engine/ alone'),
        consumerFolder('rules', 'lint/consumer/rules/ reaches catalogue/ and engine/ alone'),
        consumerFolder('checks', 'lint/consumer/checks/ reaches catalogue/ and engine/ alone'),
        {
            deny: [SELF, SOURCE],
            files: ['lint/index.*'],
            message:
                'the shipped entry imports neither self/ (never shipped) nor src/ (the command)',
            name: 'lint/index',
        },
        {
            deny: [SOURCE],
            files: ['lint/self/**'],
            message:
                'lint/self/ holds this repository to account through lint/, never src/ (the command)',
            name: 'lint/self',
        },
        {
            deny: [SELF],
            files: ['src/**'],
            message: 'src/ runs what lint/ declares, never self/',
            name: 'src',
        },
    ],
});

export default defineConfig(compose(node, testing, lintDirection));
