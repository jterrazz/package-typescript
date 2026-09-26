// Self-referenced through the exports map, as a consumer imports it.
import { testing } from '@jterrazz/test/oxlint';
import { compose, defineConfig, layers, node } from '@jterrazz/typescript/oxlint';

const SELF = '**/self/**';
const MIGRATION = '**/migration/**';
const SOURCE = '**/src/**';
const SHIPPED_REACH = [SELF, MIGRATION, SOURCE];

const LINT_FOLDERS = ['catalogue', 'rulebook', 'rules', 'checks', 'ratchet'] as const;

type LintFolder = (typeof LINT_FOLDERS)[number];

function lintFolder(
    folder: 'reading' | LintFolder,
    reaches: readonly LintFolder[],
    message: string,
) {
    return {
        deny: [
            ...LINT_FOLDERS.filter((other) => other !== folder && !reaches.includes(other)).map(
                (other) => `**/${other}/**`,
            ),
            ...SHIPPED_REACH,
        ],
        files: [`lint/${folder}/**`],
        message: `${message}, never self/, migration/ nor src/`,
        name: `lint/${folder}`,
    };
}

const lintDirection = layers({
    id: 'lint-direction',
    map: [
        lintFolder(
            'reading',
            [],
            'lint/reading/ is the floor — it imports no other folder of lint/',
        ),
        lintFolder(
            'catalogue',
            [],
            'lint/catalogue/ reaches reading/ alone — every rule and decision reads its sentence from it',
        ),
        lintFolder(
            'rulebook',
            ['catalogue'],
            'lint/rulebook/ reaches catalogue/ and reading/ alone',
        ),
        lintFolder('rules', ['catalogue'], 'lint/rules/ reaches catalogue/ and reading/ alone'),
        lintFolder('ratchet', ['catalogue'], 'lint/ratchet/ reaches catalogue/ and reading/ alone'),
        lintFolder(
            'checks',
            ['catalogue', 'ratchet'],
            'lint/checks/ reaches catalogue/, ratchet/ and reading/ alone',
        ),
        {
            deny: SHIPPED_REACH,
            files: ['lint/index.*'],
            message:
                'shipped lint/ imports neither self/ (never shipped), migration/ (deleted by the next major) nor src/ (the engine)',
            name: 'lint/index',
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
