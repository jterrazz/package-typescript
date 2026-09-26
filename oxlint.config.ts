// Self-referenced through the exports map, as a consumer imports it.
import { testing } from '@jterrazz/test/oxlint';
import { compose, defineConfig, layers, node } from '@jterrazz/typescript/oxlint';

const SELF = '**/self/**';
const MIGRATION = '**/migration/**';
const SOURCE = '**/src/**';
const SHIPPED_REACH = [SELF, MIGRATION, SOURCE];

const lintDirection = layers({
    id: 'lint-direction',
    map: [
        {
            deny: [
                '**/rulebook/**',
                '**/catalogue/**',
                '**/rules/**',
                '**/checks/**',
                '**/ratchet/**',
                ...SHIPPED_REACH,
            ],
            files: ['lint/reading/**'],
            message: 'lint/reading/ is the floor — it imports no other folder of lint/',
            name: 'lint/reading',
        },
        {
            deny: [
                '**/catalogue/**',
                '**/rules/**',
                '**/checks/**',
                '**/ratchet/**',
                ...SHIPPED_REACH,
            ],
            files: ['lint/rulebook/**'],
            message:
                'lint/rulebook/ reaches reading/ alone — rules, checks and the ratchet sit above it',
            name: 'lint/rulebook',
        },
        {
            deny: ['**/rules/**', '**/checks/**', '**/ratchet/**', ...SHIPPED_REACH],
            files: ['lint/catalogue/**'],
            message: 'lint/catalogue/ reaches reading/ and rulebook/ alone',
            name: 'lint/catalogue',
        },
        {
            deny: SHIPPED_REACH,
            files: ['lint/rules/**', 'lint/checks/**', 'lint/ratchet/**', 'lint/index.*'],
            message:
                'shipped lint/ imports neither self/ (never shipped), migration/ (deleted by the next major) nor src/ (the engine)',
            name: 'lint/shipped',
        },
        {
            deny: [SELF, SOURCE],
            files: ['lint/migration/**'],
            message: 'lint/migration/ imports what it moves, never self/ nor src/',
            name: 'lint/migration',
        },
        {
            deny: [SELF, MIGRATION],
            files: ['src/**'],
            message:
                'src/ runs what lint/ judges, never self/ nor the migration — only bin/ reaches migration/',
            name: 'src',
        },
    ],
});

export default defineConfig(compose(node, testing, lintDirection));
